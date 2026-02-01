## Coding Instructions

- Don't model impossible state. Use discriminated unions instead of optional properties to allow for different state possibilities while excluding impossible states.
- Never use typescript enums. Use string literals.
- Never write typescript classes unless required by a dependency. Use builder patterns/factory functions
- Explicitly annotate function return types unless there is a strong reason for inference (e.g., a very complicated type). A good rule of thumb is if the return type would take more than 20 characters to display, you can probably let it be inferred.
- Use objects and destruction for multiple function arguments so that you get the effect of named arguments. You can ignore this in very simple cases, i.e., one or two argument functions.
