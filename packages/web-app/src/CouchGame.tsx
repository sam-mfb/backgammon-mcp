import { useState, useCallback, useEffect } from "react";
import type { MoveFrom, MoveTo, PointIndex, Player } from "@backgammon/game";
import { useAppDispatch, useAppSelector } from "./hooks";
import {
  resetGame,
  selectValidMoves,
  selectCanEndTurn,
  selectPhase,
  selectCurrentPlayer,
  selectBoard,
  selectRemainingMoves,
  performStartGame,
  performRollDice,
  performMove,
  performEndTurn,
} from "@backgammon/game";
import { BoardView } from "@backgammon/viewer";

export function CouchGame() {
  const dispatch = useAppDispatch();
  const gameState = useAppSelector((state) => state.game);

  const [selectedSource, setSelectedSource] = useState<
    PointIndex | "bar" | null
  >(null);
  const [validDestinations, setValidDestinations] = useState<readonly MoveTo[]>(
    [],
  );

  const phase = useAppSelector(selectPhase);
  const currentPlayer = useAppSelector(selectCurrentPlayer);
  const board = useAppSelector(selectBoard);
  const remainingMoves = useAppSelector(selectRemainingMoves);

  // Use memoized selectors for expensive computations
  const availableMoves = useAppSelector(selectValidMoves);
  const canEndTurnNow = useAppSelector(selectCanEndTurn);

  // Auto-end turn if no moves available
  useEffect(() => {
    if (
      phase === "moving" &&
      availableMoves.length === 0 &&
      remainingMoves.length > 0
    ) {
      // No moves possible but still have dice - auto end turn
      const action = dispatch(performEndTurn());
      const result = action.meta.result;
      if (!result || !result.ok) {
        console.error(
          "Auto end turn failed:",
          result?.ok === false ? result.error.message : "unknown error",
        );
      }
    }
  }, [phase, availableMoves, remainingMoves, dispatch]);

  // Handle starting the game using the new operation
  const handleStartGame = useCallback(() => {
    dispatch(performStartGame());
  }, [dispatch]);

  // Handle rolling dice
  const handleRollClick = useCallback(() => {
    if (phase !== "rolling") return;
    const action = dispatch(performRollDice());
    const result = action.meta.result;
    if (!result || !result.ok) {
      console.error(
        "Roll failed:",
        result?.ok === false ? result.error.message : "unknown error",
      );
      return;
    }
    setSelectedSource(null);
    setValidDestinations([]);
  }, [phase, dispatch]);

  // Handle end turn
  const handleEndTurnClick = useCallback(() => {
    if (phase !== "moving") return;
    const action = dispatch(performEndTurn());
    const result = action.meta.result;
    if (!result || !result.ok) {
      console.error(
        "End turn failed:",
        result?.ok === false ? result.error.message : "unknown error",
      );
      return;
    }
    setSelectedSource(null);
    setValidDestinations([]);
  }, [phase, dispatch]);

  // Handle reset/new game
  const handleNewGame = useCallback(() => {
    dispatch(resetGame());
    setSelectedSource(null);
    setValidDestinations([]);
  }, [dispatch]);

  // Get valid destinations for a source position
  const getDestinationsForSource = useCallback(
    (source: MoveFrom): MoveTo[] => {
      if (availableMoves.length === 0) return [];
      const available = availableMoves.find((am) => am.from === source);
      if (!available) return [];
      return available.destinations.map((d) => d.to);
    },
    [availableMoves],
  );

  // Handle point click
  const handlePointClick = useCallback(
    (pointIndex: PointIndex) => {
      if (phase !== "moving" || !currentPlayer) return;

      // Check if this point is a valid destination for the selected source
      if (selectedSource !== null && validDestinations.includes(pointIndex)) {
        // Make the move
        const source = selectedSource;
        const availableMove = availableMoves?.find((am) => am.from === source);
        const destination = availableMove?.destinations.find(
          (d) => d.to === pointIndex,
        );

        if (destination) {
          const action = dispatch(
            performMove({
              from: source,
              to: pointIndex,
              dieUsed: destination.dieValue,
            }),
          );
          const result = action.meta.result;
          if (!result || !result.ok) {
            console.error(
              "Move failed:",
              result?.ok === false ? result.error.message : "unknown error",
            );
            return;
          }
          setSelectedSource(null);
          setValidDestinations([]);
        }
        return;
      }

      // Check if this point has the current player's checker and can be selected
      const pointValue = board.points[pointIndex - 1];
      const hasCurrentPlayerChecker =
        (currentPlayer === "white" && pointValue > 0) ||
        (currentPlayer === "black" && pointValue < 0);

      // If player has checkers on bar, they must move from bar first
      if (board.bar[currentPlayer] > 0) {
        // Cannot select points when checkers are on bar
        setSelectedSource(null);
        setValidDestinations([]);
        return;
      }

      if (hasCurrentPlayerChecker) {
        const destinations = getDestinationsForSource(pointIndex);
        if (destinations.length > 0) {
          // Select this point
          setSelectedSource(pointIndex);
          setValidDestinations(destinations);
        } else {
          // No valid moves from this point
          setSelectedSource(null);
          setValidDestinations([]);
        }
      } else {
        // Clicked on empty or opponent's point - deselect
        setSelectedSource(null);
        setValidDestinations([]);
      }
    },
    [
      phase,
      currentPlayer,
      selectedSource,
      validDestinations,
      availableMoves,
      board,
      dispatch,
      getDestinationsForSource,
    ],
  );

  // Handle bar click
  const handleBarClick = useCallback(
    (player: Player) => {
      if (phase !== "moving" || player !== currentPlayer) return;

      if (board.bar[player] > 0) {
        const destinations = getDestinationsForSource("bar");
        if (destinations.length > 0) {
          setSelectedSource("bar");
          setValidDestinations(destinations);
        }
      }
    },
    [phase, currentPlayer, board.bar, getDestinationsForSource],
  );

  // Handle borne-off area click (for bearing off moves)
  const handleBorneOffClick = useCallback(
    (_player: Player) => {
      if (
        phase !== "moving" ||
        selectedSource === null ||
        !validDestinations.includes("off")
      )
        return;

      // Make bearing off move
      const availableMove = availableMoves?.find(
        (am) => am.from === selectedSource,
      );
      const destination = availableMove?.destinations.find(
        (d) => d.to === "off",
      );

      if (destination) {
        const action = dispatch(
          performMove({
            from: selectedSource,
            to: "off",
            dieUsed: destination.dieValue,
          }),
        );
        const result = action.meta.result;
        if (!result || !result.ok) {
          console.error(
            "Bear off failed:",
            result?.ok === false ? result.error.message : "unknown error",
          );
          return;
        }
        setSelectedSource(null);
        setValidDestinations([]);
      }
    },
    [phase, selectedSource, validDestinations, availableMoves, dispatch],
  );

  return (
    <div className="couch-game">
      <h1>Backgammon</h1>

      {phase === "not_started" && (
        <div className="couch-game__start">
          <button
            className="couch-game__start-button"
            onClick={handleStartGame}
          >
            Start Game
          </button>
        </div>
      )}

      {phase !== "not_started" && (
        <BoardView
          gameState={gameState}
          selectedSource={selectedSource}
          validDestinations={validDestinations}
          canEndTurn={canEndTurnNow}
          onPointClick={handlePointClick}
          onBarClick={handleBarClick}
          onBorneOffClick={handleBorneOffClick}
          onRollClick={handleRollClick}
          onEndTurnClick={handleEndTurnClick}
        />
      )}

      {phase === "game_over" && (
        <div className="couch-game__game-over">
          <button
            className="couch-game__new-game-button"
            onClick={handleNewGame}
          >
            New Game
          </button>
        </div>
      )}
    </div>
  );
}
