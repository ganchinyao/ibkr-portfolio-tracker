# 📊 IBKR Portfolio Tracker

The IBKR Portfolio Tracker is a cron job that tracks investment portfolio performance on Interactive Brokers (IBKR) and sends automated weekly updates via Telegram.

<image src="./promo/img-1.png" width="300px" />

## Features

The cron job operates once a day to fetch the previous trading day's portfolio value and stores this information into a database. Every Friday, it sends a Telegram message to provide an update on your portfolio's value.

## How it works

1. The Vercel cron job triggers the daily cron job once a day.
2. The cron job fetches the portfolio value for the last trading day, storing this value and relevant date in the database.
3. On Fridays, a Telegram message detailing the portfolio value is sent to a pre-specified channel.

**Retrieving IBKR Value**

The portfolio value is safely obtained through the IBKR Flex Web Service API, which doesn't require trading permissions, setting up the Trader Workstation, or access to your password. More information on setting this up can be found under [IBKR Flex Token](#ibkr-flex-token)


## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Telegram Bot Token
- Telegram Chat ID
- IBKR Flex Token
- Database (PostgreSQL, MySQL, or SQLite)

### Installation

1. Clone the repository to your system.

2. Install local package dependencies:

```bash
npm install
```

3. Set up environment variables:

   Create a `.env` file in your project's root directory with the following:

```env
CRON_SECRET=a_random_string
IBKR_FLEX_TOKEN=from_ibkr
IBKR_FLEX_QUERY_ID=from_ibkr
DATABASE_URL='postgresql://your_database_string'
TELEGRAM_BOT_TOKEN=your:telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

4. Set up the database

```bash
npm run generate
npm run migrate
```

5. Launch the development server:

```bash
npm run dev
```

The cron job is served through `/api/cron`


## Configuration

### Telegram Bot Setup

1. **Create a Telegram Bot**:
   - Message [@BotFather](https://t.me/botfather) on Telegram
   - Use `/newbot` command
   - Follow the instructions to get your bot token

2. **Get your Chat ID**:
   - Start a chat with your bot
   - Send a message
   - Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Find your chat ID in the response

### IBKR Flex Token

We utilize the IBKR Flex Web Service to safely generate a portfolio value report. This method provides read-only access, without granting trading permissions.

1. Navigate to IBKR on your browser and log in.
2. Select `Performance & Reports` > `Flex Queries`.
3. In the `Flex Web Service Configuration`, click on `Configure` and generate a new token. This token will serve as your `IBKR_FLEX_TOKEN` environment variable.
4. Return to `Flex Queries`. In the `Activity Flex Query`, create a new Flex Query.
    - Assign a name to the query.
    - Under `Change in NAV`, check `From Date`, `To Date`, and `Ending Value`.
5. Configure the Delivery Configurations as follows:
    - Models: Optional
    - Format: CSV
    - Include header and trailer records: No
    - Include column headers: Yes
    - Display Single column header row: No
    - Include section code and line description: No
    - Period: Last business day
6. Under General Configuration, select the following:
    - Date Format: yyyyMMdd
    - Time Format: HHmmss
    - Date/Time Separator: ; (semi-colon)
    - Profit and Loss: Default
    - All other options: No
7. Save the Flex Query.
8. Select the `Edit` button of the query you just created. This allows you to note down the `Query ID`. This will be your `IBKR_FLEX_QUERY_ID` environment variable.

This process creates a flex token that allows for programmatic calling of the created Flex Query to get the `From Date`, `To Date`, and `Ending Value` for the previous business day, which is your portfolio value.

## Deployment

### Vercel Deployment

This project is set up for straightforward deployment through Vercel.

Simply upload your project to Vercel.

To change the cron timing, modify the `vercel.json` file:

```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 15 * * *"
    }
  ]
}
```

Note: Ensure you've obtained a random string for the `CRON_SECRET` environment variable. This secret is checked against incoming requests. If there is a mismatch, the request will not be processed. This ensures only the Vercel cron job is authorized to trigger the `POST` request in `api/cron`.

