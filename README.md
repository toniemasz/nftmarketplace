# NFT Marketplace Example

This project is a minimal demonstration of an NFT marketplace using a Solidity contract, a Node.js backend and a simple web frontend. Users authenticate with a username and password stored in `backend/users.json`. Wallet keys are managed server-side so no browser extensions are required (not secure for production).

## Structure

- `contracts/` – Solidity contract.
- `artifacts/` – compiled ABI and bytecode generated with `solcjs`.
- `backend/` – Node.js server and user database.
- `frontend/` – static web pages.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run a local JSON-RPC provider (for example Hardhat node):
   ```bash
   npx hardhat node
   ```
3. Start the server in another terminal:
   ```bash
   node backend/server.js
   ```
4. Open `http://localhost:3000` in the browser.

New users can register via the homepage. The server will automatically
create an `admin` account in `backend/users.json` if none exists and use
it to deploy the contract when starting.
