# Project Structure Guidelines

## General Principles

- Keep frontend and backend clearly separated
- Group related files together
- Avoid dumping everything into one folder

---

## Recommended Structure
```text
/frontend
  /components
  /pages
  /services

/backend
  /routes
  /controllers
  /services

/shared
  /types
  /utils
```

---

## Rules

- No deeply nested folders unless necessary
- File names should be descriptive
- Avoid duplicate logic across files

---

## Agent Expectations

When creating new files:
- Place them in the correct layer
- Do not invent random folders
- Reuse existing structure when possible

---

## If Unsure

Ask:
"Should this live in frontend, backend, or shared?"
