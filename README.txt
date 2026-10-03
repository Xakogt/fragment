FRAGMENT.LOL PANEL 2.0

LOCAL SETUP
1) Open Command Prompt in this folder.
2) npm install
3) copy .env.example .env
4) npm start
5) Open http://localhost:3000

ADMIN
Username: xako
Password: Miseryisgoated

KEY TYPES
GUI:   FRAGMENTGUI-XXXX-XXX
TABLE: FRAGMENT-XXXX-XXX

PRODUCTS
Each account can own both products. Signup activates the first key. Profile / Redeem activates the second key.
The redeem endpoint now updates the actual users.json record AND the active session, so the second product is immediately recognized by Dashboard, Config, and Download Loadstring.

LOADERS
There are exactly two live product load URLs:
  /api/v1/gui/loader?key=<GUI_KEY>
  /api/v1/table/loader?key=<TABLE_KEY>

The Dashboard downloads only the generated loadstring. It does not download gui.lua or table.lua.

TABLE CONFIG
Each user with the Table product gets a Config tab. Save & Apply stores that user's configuration. The same Table loadstring remains valid; the next live Table loader request uses the latest saved configuration.

SOURCE PROTECTION
Direct source-style routes return the Not Authorized page instead of rendering the Lua source:
  /gui.lua
  /table.lua
  /api/v1/gui/source
  /api/v1/table/source

VERCEL
The current local build is designed around JSON files and in-memory sessions/tokens, so it should NOT be deployed to Vercel unchanged. Vercel Functions run in a serverless environment and local runtime filesystem writes are not a durable application database.

For Vercel production, move users/keys/configuration/session/token state to a persistent external datastore (for example Redis/Postgres) and keep secrets in Vercel Environment Variables. The frontend/static portion and serverless API architecture can run on Vercel after that storage migration.

Also use a current Node.js runtime; Vercel has deprecated Node.js 20 for new deployments as of October 1, 2026, while Node.js 24 is available for Builds and Functions.
