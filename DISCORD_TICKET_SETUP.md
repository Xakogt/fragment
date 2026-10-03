# Fragment Discord Ticket Shop

This adds a Discord ticket purchase flow for:

- Fragment Software — $12
- Fragment GUI — $15
- Fragment Table — $25

The bot creates a private ticket, collects a gift-card code, posts the order to a staff-only review channel, and waits for a staff member to manually verify the payment. Clicking **Approve & Deliver** calls the Fragment API to generate a license key and DMs it to the buyer.

## Important

The bot does **not** automatically redeem or validate gift cards. Staff should verify the payment with the gift-card provider before pressing Approve & Deliver.

## Setup

1. Create a Discord application/bot and enable the bot.
2. Invite it with permissions to manage channels, send messages, read message history, and use slash commands.
3. Create:
   - a ticket category (optional)
   - a staff-only review channel
   - a staff role
4. Copy `.env.example` to `.env` and fill in:

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_client_id
DISCORD_GUILD_ID=your_server_id
TICKET_CATEGORY_ID=your_ticket_category_id
REVIEW_CHANNEL_ID=your_staff_review_channel_id
STAFF_ROLE_ID=your_staff_role_id
FRAGMENT_API_URL=http://localhost:3000
INTERNAL_API_SECRET=use-a-long-random-secret
GIFT_CARD_INSTRUCTIONS=Send a supported gift card and enter its code in the ticket. Staff will verify the gift card manually before approval.
TICKET_CLOSE_DELAY_MS=8000
```

Use the exact same `INTERNAL_API_SECRET` in the Fragment web server's environment and the Discord bot's environment.

5. Install dependencies:

```bash
npm install
```

6. Start the Fragment website/API:

```bash
npm start
```

7. Start the Discord bot in another terminal:

```bash
npm run bot
```

8. In your Discord server, run:

```text
/setup-shop
```

The command must be run by someone with Manage Server or the configured staff role.

## Purchase flow

```text
User selects Software / GUI / Table
        ↓
Private ticket is created
        ↓
User submits gift-card code
        ↓
Code is sent to the staff review channel
        ↓
Staff verifies payment manually
        ↓
Approve & Deliver
        ↓
Fragment API generates a product-specific license key
        ↓
Bot DMs the key to the buyer
        ↓
Ticket is closed
```

The generated key formats are:

```text
Software: FRAGMENTSW-XXXX-XXX
GUI:      FRAGMENTGUI-XXXX-XXX
Table:    FRAGMENT-XXXX-XXX
```

Keep the review channel private because it contains submitted payment codes.
