# Testing Policy

## Purpose

Ensure code works as expected and does not break existing functionality.

Testing should reduce risk, not add unnecessary complexity.

---

## Core Principles

- Test important logic, not everything
- Prefer simple tests over complex ones
- Focus on behavior, not implementation details

---

## When to Add Tests

The agent should add tests when:

- New features are introduced
- Bugs are fixed to prevent regression
- Critical logic is modified

---

## Types of Tests

### Unit Tests

- Test individual functions
- Keep them fast and isolated

### Integration Tests

- Use when logic spans multiple layers
- Prefer them when component interaction is the real risk
- Keep them focused on meaningful boundaries

---

## What NOT to Do

- Do not over-test trivial code
- Do not create overly complex test setups
- Do not block progress for missing tests unless the change is critical

---

## Test Structure Guidelines

- Use clear test names
- Keep one behavior per test
- Minimize setup

---

## Example

```javascript
describe("login validation", () => {
  it("rejects empty password", () => {
    expect(validateLogin("user", "")).toBe(false);
  });
});
```

---

## Agent Behavior

The agent should:

- Suggest tests when coverage is missing
- Keep tests readable and simple
- Avoid introducing heavy frameworks unnecessarily

---

## Priority Areas

Focus on:

- Authentication logic
- API endpoints
- Data transformations
- Edge cases

---

## Hard Stops

Push back if:

- Critical logic is shipped without validation
- A bug fix omits regression protection when a practical test can be added

---

## Final Rule

Testing should increase confidence without slowing development unnecessarily.
