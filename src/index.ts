import fs from "node:fs";

import {ArgumentParser} from "argparse";
import puppeteer, {PuppeteerLaunchOptions} from "puppeteer";

import {DiscordNotifier} from "./notifiers/discord.js";
import {JourneyInfo, Watchdog} from "./watchdog.js";
import logger from "./logger.js";
import {Notifier} from "./notifiers/notifier.js";

function loadConfigFile(file_path: string) {
    if (fs.existsSync(file_path)) {
        try {
            return JSON.parse(fs.readFileSync(file_path, {encoding: 'utf-8'}));
        } catch (error) {
            logger.error('Failed to read config file!');
            logger.error(error);
            process.exit(1);
        }
    } else {
        logger.error('No config file found!');
        process.exit(1);
    }
}

interface Config {
    watchdog: {
        interval: number
    },
    notifiers: {
        email?: {
            from: {
                address: string,
                password: string
            },
            to: string[]
        },
        discord?: {
            webhook_url: string
        }[]
    },
    blacklist?: [string]
}

function isInsideDocker(): boolean {
    return fs.existsSync("/.dockerenv");
}

async function main() {

    // Parse arguments
    const parser = new ArgumentParser();
    parser.add_argument('--config', '-c', {default: 'config.json'});
    const args = parser.parse_args();

    // Load config file
    const config = loadConfigFile(args['config']) as Config;

    // Create notifiers
    const notifiers: Notifier[] = [];
    /*if (config.notifiers.email) {
        notifiers.push(new EmailNotifier(config.notifiers.email.from.address, config.notifiers.email.from.password, config.notifiers.email.to));
    }*/
    if (config.notifiers.discord) {
        notifiers.push(new DiscordNotifier(config.notifiers.discord));
    }

    const options: PuppeteerLaunchOptions = {};
    if (isInsideDocker()) {
        options.executablePath = "chromium";
        options.args = ["--no-sandbox"];
    }
    const browser = await puppeteer.launch(options);

    const filter = (journeyInfo: JourneyInfo) => {
        const blacklist = config?.blacklist ?? [];
        for (const item of blacklist) {
            if (item === journeyInfo.item.game.assets.title) {
                return false;
            }
        }
        return true;
    };

    const watchdog = new Watchdog({browser: browser, interval: config.watchdog.interval, filter: filter});
    watchdog.on("update", (offers: JourneyInfo[]) => {
        for (const notifier of notifiers) {
            notifier.onUpdate(offers);
        }
    });
    watchdog.start();
}

main().catch((error) => {
    logger.error(error);
    process.exit(1);
});
