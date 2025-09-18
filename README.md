# Employee Gift Survey

This project provides a simple employee gift request workflow consisting of:

- A front-end survey form for employees to submit gift shipping details.
- An administrator interface for uploading the available gift catalog from CSV or XLSX files.
- A lightweight Node.js server that serves both pages, exposes the required APIs, and stores data in JSON files inside the `data/` directory.

## Getting Started

1. Install dependencies (only the built-in Node.js runtime is required).
2. Start the HTTP server:

   ```bash
   npm start
   ```

3. Open <http://localhost:3000> for the employee survey or <http://localhost:3000/admin.html> for the administration upload page.

The server stores uploaded gift data in `data/products.json` and survey submissions in `data/submissions.json`.

## Gift Upload Format

The administrator upload accepts CSV **or** XLSX files. The first row must contain column headers that are matched case-insensitively.

| Column       | Required | Description                                              |
| ------------ | -------- | -------------------------------------------------------- |
| `giftId`     | Yes      | Unique identifier for the gift. Used as the selection ID |
| `name`       | Yes      | Human-friendly gift name shown to employees              |
| `description`| Yes      | Short description of the item                            |
| `category`   | No       | Optional grouping shown next to the gift name            |

Additional columns are ignored. Each `giftId` must be unique and rows missing any required field will cause the upload to fail. On a successful upload the file is normalized into JSON and saved to `data/products.json`.

## Survey Form Usage

Employees must complete all required fields before submission:

- Your name and department
- Shipping address
- Recipient name and phone number
- Gift choice from the dynamically populated list

Optional notes can be provided for fulfillment. The page displays inline success or error messages after submission. Once the admin uploads a gift list, the form fetches `/api/products` to populate the gift choices automatically.

## API Endpoints

- `GET /api/products` – Returns `{ products: Product[] }` sourced from `data/products.json`.
- `POST /api/admin/upload` – Accepts multipart form uploads. Validates the schema above and persists gifts.
- `POST /api/submissions` – Accepts JSON survey payloads, validates required fields and phone number, verifies the gift exists, and appends the response to `data/submissions.json`.

Each endpoint responds with JSON success or error messages to support client-side feedback.

## Data Storage

The application writes JSON files to the `data/` directory. These files are append-only and can be exported for reporting. Back up `data/products.json` and `data/submissions.json` regularly if running in production.

## Development Notes

- The server is built on Node.js core modules without external dependencies to simplify deployment.
- XLSX parsing is handled by a small Python helper (`scripts/parse_xlsx.py`) invoked during uploads. Ensure Python 3 is available on the host system.
