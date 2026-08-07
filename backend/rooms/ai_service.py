import json
import os
import re
import urllib.request
import urllib.error
from django.conf import settings
from dotenv import load_dotenv

# Ensure environment variables from backend/.env are loaded
load_dotenv()


def analyze_code_with_gemini(code: str, language: str, title: str) -> dict:
    """
    Sends code to Google Gemini API and returns structured JSON analysis.
    Falls back to intelligent mock review if API returns 429 quota errors.
    Tries both v1beta and v1 endpoints.
    """
    api_key = os.getenv('GEMINI_API_KEY') or getattr(settings, 'GEMINI_API_KEY', '')

    if not api_key:
        # No API key at all — go straight to mock
        return _generate_mock_review(code, language, title, reason="no_key")

    # Try real Gemini API with multiple model + API version combinations
    endpoints_to_try = [
        ("v1beta", "gemini-1.5-flash-8b"),
        ("v1",     "gemini-1.5-flash-8b"),
        ("v1beta", "gemini-1.5-flash"),
        ("v1",     "gemini-1.5-flash"),
        ("v1beta", "gemini-2.0-flash"),
        ("v1",     "gemini-2.0-flash"),
    ]

    prompt = f"""
You are an expert senior code reviewer analyzing a code snippet.
Snippet Title: {title}
Language: {language}

Code:
```{language}
{code}
```

Provide a thorough, line-by-line review of this code. Return your response STRICTLY as a single raw valid JSON object with NO markdown tags, NO backticks, and NO extra text.

The JSON MUST match this exact structure:
{{
  "score": <integer from 1 to 100 representing overall quality>,
  "summary": "<2-3 sentence overview of code strengths and primary issues>",
  "bugs": [
    {{
      "line": <line number integer, or 0 if general>,
      "issue": "<clear description of bug, vulnerability, or logic flaw>",
      "fix": "<suggested fix or corrected code>"
    }}
  ],
  "suggestions": [
    {{
      "line": <line number integer, or 0 if general>,
      "title": "<short suggestion title>",
      "details": "<explanation of refactoring or clean code tip>"
    }}
  ],
  "improvements": [
    "<general architectural, performance, or best-practice tip>"
  ]
}}
"""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.2
        }
    }

    data_bytes = json.dumps(payload).encode('utf-8')
    last_error = ""
    got_429 = False

    for api_version, model in endpoints_to_try:
        url = f"https://generativelanguage.googleapis.com/{api_version}/models/{model}:generateContent?key={api_key}"
        try:
            req = urllib.request.Request(url, data=data_bytes, headers={'Content-Type': 'application/json'})

            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.loads(response.read().decode('utf-8'))

                candidates = result.get('candidates', [])
                if not candidates:
                    raise ValueError("No candidates returned from Gemini API.")

                parts = candidates[0].get('content', {}).get('parts', [])
                if not parts:
                    raise ValueError("Empty response text from Gemini API.")

                raw_text = parts[0].get('text', '').strip()

                # Strip backticks if present
                if raw_text.startswith("```"):
                    lines = raw_text.splitlines()
                    if lines[0].startswith("```"):
                        lines = lines[1:]
                    if lines and lines[-1].startswith("```"):
                        lines = lines[:-1]
                    raw_text = "\n".join(lines).strip()

                parsed_json = json.loads(raw_text)

                # Parse score safely
                raw_score = parsed_json.get("score", 75)
                try:
                    score = int(float(str(raw_score).split('/')[0]))
                except (ValueError, TypeError):
                    score = 75

                return {
                    "score": score,
                    "summary": str(parsed_json.get("summary", "Analysis completed.")),
                    "bugs": parsed_json.get("bugs", []),
                    "suggestions": parsed_json.get("suggestions", []),
                    "improvements": parsed_json.get("improvements", [])
                }

        except urllib.error.HTTPError as e:
            last_error = f"HTTP {e.code} on {api_version}/{model}"
            if e.code in (404, 429):
                if e.code == 429:
                    got_429 = True
                continue
            else:
                # Non-recoverable error — fall to mock
                break
        except Exception as e:
            last_error = str(e)
            continue

    # All endpoints failed — use intelligent mock fallback
    reason = "quota_exceeded" if got_429 else "api_error"
    return _generate_mock_review(code, language, title, reason=reason)



# ─────────────────────────────────────────────────────────────
# Intelligent Mock Review Generator
# ─────────────────────────────────────────────────────────────

# Language-specific common issues and suggestions
_LANGUAGE_PATTERNS = {
    "python": {
        "bugs": [
            {"issue": "No input validation — function accepts any type without type checking, risking TypeError at runtime.", "fix": "Add isinstance() checks or use type hints with runtime validation (e.g., pydantic)."},
            {"issue": "Bare except clause catches all exceptions including KeyboardInterrupt and SystemExit.", "fix": "Use 'except Exception as e:' instead of bare 'except:' to avoid masking critical errors."},
            {"issue": "Mutable default argument in function definition (e.g., def f(items=[])).", "fix": "Use 'None' as default and initialize inside the function: 'if items is None: items = []'."},
        ],
        "suggestions": [
            {"title": "Use f-strings for readability", "details": "Replace string concatenation and .format() calls with f-strings for cleaner, more performant string interpolation."},
            {"title": "Add docstrings", "details": "Add Google-style or NumPy-style docstrings to all public functions to improve code documentation and IDE support."},
            {"title": "Use list comprehensions", "details": "Replace manual for-loop list building with list comprehensions for more Pythonic and often faster code."},
        ],
        "improvements": [
            "Add type hints (PEP 484) to all function signatures for better IDE support and static analysis.",
            "Consider using a linter like flake8 or ruff to enforce consistent code style.",
            "Add logging via the 'logging' module instead of print() statements for production readiness.",
            "Write unit tests using pytest to ensure correctness and prevent regressions.",
        ],
    },
    "javascript": {
        "bugs": [
            {"issue": "Using '==' instead of '===' for comparison — loose equality can cause unexpected type coercion bugs.", "fix": "Always use '===' (strict equality) and '!==' (strict inequality) in JavaScript."},
            {"issue": "No error handling for async operations — unhandled promise rejections can crash the application.", "fix": "Wrap async/await calls in try/catch blocks and handle errors gracefully."},
            {"issue": "Variable declared with 'var' — function-scoped hoisting can cause subtle bugs.", "fix": "Use 'const' for values that don't change, 'let' for variables that do. Never use 'var'."},
        ],
        "suggestions": [
            {"title": "Use destructuring", "details": "Use object/array destructuring for cleaner variable extraction: const { name, age } = user;"},
            {"title": "Use optional chaining", "details": "Replace nested null checks with optional chaining (user?.address?.city) to avoid TypeError on undefined."},
            {"title": "Use arrow functions consistently", "details": "Replace function expressions with arrow functions for shorter syntax and lexical 'this' binding."},
        ],
        "improvements": [
            "Add ESLint with a popular config (e.g., airbnb) to enforce consistent code style.",
            "Use TypeScript for type safety on larger projects — it catches bugs at compile time.",
            "Add JSDoc comments to exported functions for better documentation and IDE IntelliSense.",
            "Implement error boundaries and centralized error handling for production resilience.",
        ],
    },
    "typescript": {
        "bugs": [
            {"issue": "Using 'any' type defeats the purpose of TypeScript — it disables all type checking.", "fix": "Replace 'any' with specific types, union types, or generics to maintain type safety."},
            {"issue": "Missing null checks — accessing properties on potentially null values causes runtime crashes.", "fix": "Use optional chaining (?.) and nullish coalescing (??) to safely handle null/undefined values."},
            {"issue": "No return type annotation — implicit 'any' return type reduces type safety.", "fix": "Add explicit return type annotations to all functions: function getName(): string { ... }"},
        ],
        "suggestions": [
            {"title": "Use interfaces over type aliases for objects", "details": "Interfaces are extendable and provide better error messages. Use 'type' for unions and intersections."},
            {"title": "Enable strict mode in tsconfig.json", "details": "Set 'strict': true in tsconfig.json to enable all strict type-checking options."},
            {"title": "Use enums for fixed sets of values", "details": "Replace magic strings with TypeScript enums for better type safety and refactoring support."},
        ],
        "improvements": [
            "Enable strict null checks ('strictNullChecks': true) to catch null pointer errors at compile time.",
            "Use readonly modifiers on properties that should not be reassigned after initialization.",
            "Add comprehensive unit tests with Jest and type-safe mocks.",
            "Consider using Zod for runtime validation of external data (API responses, user input).",
        ],
    },
    "java": {
        "bugs": [
            {"issue": "NullPointerException risk — object reference used without null check.", "fix": "Use Optional<T> or add explicit null checks before accessing object members."},
            {"issue": "Resource leak — stream/connection opened but not closed in a finally block.", "fix": "Use try-with-resources: try (var stream = new FileInputStream(file)) { ... }"},
            {"issue": "Catching generic Exception instead of specific exception types.", "fix": "Catch specific exceptions (IOException, SQLException) to handle each error case appropriately."},
        ],
        "suggestions": [
            {"title": "Use final for immutable variables", "details": "Mark variables as 'final' when they are assigned once to prevent accidental reassignment."},
            {"title": "Use StringBuilder for string concatenation in loops", "details": "String concatenation in loops creates many temporary objects. Use StringBuilder for better performance."},
            {"title": "Follow Java naming conventions", "details": "Use camelCase for methods/variables, PascalCase for classes, and UPPER_SNAKE_CASE for constants."},
        ],
        "improvements": [
            "Add Javadoc comments to all public classes and methods.",
            "Use dependency injection (e.g., Spring) instead of manual object creation for testability.",
            "Write JUnit 5 unit tests with descriptive test method names.",
            "Consider using records (Java 16+) for simple immutable data carriers.",
        ],
    },
}

# Default patterns for languages not explicitly covered
_DEFAULT_PATTERNS = {
    "bugs": [
        {"issue": "No error handling — function does not handle edge cases or invalid input.", "fix": "Add input validation and try/catch blocks to handle errors gracefully."},
        {"issue": "Hardcoded values should be extracted to named constants for maintainability.", "fix": "Define constants at the top of the file or in a configuration module."},
    ],
    "suggestions": [
        {"title": "Add inline comments for complex logic", "details": "Document non-obvious code with brief comments explaining the 'why', not the 'what'."},
        {"title": "Extract repeated logic into helper functions", "details": "DRY principle — if code is repeated more than twice, extract it into a reusable function."},
    ],
    "improvements": [
        "Add comprehensive error handling and input validation.",
        "Write unit tests to verify correctness and prevent regressions.",
        "Follow the Single Responsibility Principle — each function should do one thing well.",
        "Add code documentation for maintainability and onboarding.",
    ],
}


def _generate_mock_review(code: str, language: str, title: str, reason: str = "quota_exceeded") -> dict:
    """
    Generates a realistic-looking AI code review based on static code analysis.
    Used as fallback when Gemini API is unavailable (quota/billing issues).
    """
    lines = code.strip().splitlines()
    total_lines = len(lines)
    non_empty_lines = len([l for l in lines if l.strip()])
    comment_lines = 0
    has_functions = False
    has_classes = False
    has_imports = False
    has_error_handling = False
    long_lines = 0

    # Basic static analysis
    comment_markers = {'python': '#', 'javascript': '//', 'typescript': '//', 'java': '//', 'cpp': '//', 'css': '/*', 'sql': '--'}
    marker = comment_markers.get(language, '#')

    for line in lines:
        stripped = line.strip()
        if stripped.startswith(marker):
            comment_lines += 1
        if len(line) > 100:
            long_lines += 1
        # Detect common structures
        if re.search(r'\b(def |function |const \w+ = \(|=> |void |public )', stripped):
            has_functions = True
        if re.search(r'\b(class |interface |struct )', stripped):
            has_classes = True
        if re.search(r'\b(import |from |require\(|#include)', stripped):
            has_imports = True
        if re.search(r'\b(try|catch|except|finally|throw|raise)\b', stripped):
            has_error_handling = True

    # Calculate a realistic score (60-85 range)
    score = 72
    if comment_lines > 0:
        score += 3
    if has_error_handling:
        score += 4
    if has_imports:
        score += 2
    if total_lines > 50:
        score -= 3  # Longer files tend to have more issues
    if long_lines > 3:
        score -= 2
    if not has_functions and total_lines > 10:
        score -= 3  # No functions in a non-trivial file
    score = max(60, min(85, score))

    # Get language-specific patterns or defaults
    patterns = _LANGUAGE_PATTERNS.get(language, _DEFAULT_PATTERNS)

    # Build bugs list — pick relevant ones and assign realistic line numbers
    bugs = []
    available_bugs = patterns.get("bugs", _DEFAULT_PATTERNS["bugs"])
    num_bugs = min(len(available_bugs), 2 if total_lines < 20 else 3)
    for i in range(num_bugs):
        bug = available_bugs[i]
        # Assign a realistic line number within the code
        line_num = min(total_lines, max(1, (total_lines // (num_bugs + 1)) * (i + 1)))
        bugs.append({
            "line": line_num,
            "issue": bug["issue"],
            "fix": bug["fix"]
        })

    # Build suggestions list
    suggestions = []
    available_suggestions = patterns.get("suggestions", _DEFAULT_PATTERNS["suggestions"])
    num_suggestions = min(len(available_suggestions), 2 if total_lines < 15 else 3)
    for i in range(num_suggestions):
        sug = available_suggestions[i]
        line_num = min(total_lines, max(1, (total_lines // (num_suggestions + 1)) * (i + 1)))
        suggestions.append({
            "line": line_num,
            "title": sug["title"],
            "details": sug["details"]
        })

    # Build improvements list
    improvements = patterns.get("improvements", _DEFAULT_PATTERNS["improvements"])[:4]

    # Build summary
    strengths = []
    issues_found = []
    if has_imports:
        strengths.append("proper use of imports/modules")
    if has_functions:
        strengths.append("modular function structure")
    if has_classes:
        strengths.append("object-oriented design")
    if comment_lines > 0:
        strengths.append("includes code comments")
    if not has_error_handling:
        issues_found.append("no error handling")
    if long_lines > 0:
        issues_found.append(f"{long_lines} lines exceed 100 characters")
    if total_lines > 0 and comment_lines / total_lines < 0.05:
        issues_found.append("insufficient documentation")

    strength_text = ", ".join(strengths[:2]) if strengths else "basic structure"
    issues_text = ", ".join(issues_found[:2]) if issues_found else "minor style improvements needed"

    if reason == "no_key":
        note = "Note: This is a demo review (no API key configured). Add GEMINI_API_KEY to backend/.env for real AI analysis."
    else:
        note = "Note: This is a demo review. Connect a valid Gemini API key for real AI analysis."

    summary = f"The code shows {strength_text} across {non_empty_lines} lines of {language}. Primary areas for improvement: {issues_text}. {note}"

    return {
        "score": score,
        "summary": summary,
        "bugs": bugs,
        "suggestions": suggestions,
        "improvements": improvements
    }