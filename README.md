# Prime Loot Watchdog

A Node.js bot for notifying you of new [Amazon Prime loot](https://gaming.amazon.com/home).

## Usage

1) Install [Node.js](https://nodejs.org/)
2) Install this package: `npm install .`
3) Compile `tsc`
4) Start the bot with `node dist/index.js`

### Configuration

The bot also requires a `config.json` file. Here is a sample:
```
{
    "watchdog": {
        "interval": 480
    },
    "email": {
        "from": {
            "address": "my_from_email@email.com",
            "password": "my_password"
        },
        "to": [
            "my_to_email@email.com"
        ]
    }
}
```
The `interval` is the minutes in between checks for new offers. Multiple `to` addresses can be provided.
