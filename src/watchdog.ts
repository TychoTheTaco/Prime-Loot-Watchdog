import {EventEmitter} from "node:events";

import puppeteer, {Browser} from "puppeteer";

const TimeoutError = puppeteer.errors.TimeoutError;

import {PrimeOffer, Client, Item, Journey} from "./twitch.js";
import logger from "./logger.js";
import fs from "node:fs";
import * as path from "path";

export interface JourneyInfo {
    prime_offer: PrimeOffer,
    item: Item
}

export async function getPrimeOffers(browser: Browser): Promise<JourneyInfo[]> {
    const client = new Client(browser);
    const primeOffers = await client.getPrimeOffers();

    const journeyOffersObject: { [key: string]: JourneyInfo } = {};
    for (const primeOffer of primeOffers) {

        if (primeOffer.deliveryMethod != "EXTERNAL_OFFER") {
            logger.debug("Ignoring non external offer: " + primeOffer.content.externalURL);
            continue;
        }

        // Ignore Luna offers
        if (primeOffer.content.externalURL.startsWith('https://www.amazon.com/luna')) {
            logger.debug("Ignoring luna offer: " + primeOffer.id + " " + primeOffer.title);
            continue;
        }

        // Get item details
        let item = null;
        try {
            item = await client.getItemContext(primeOffer);
        } catch (error) {
            if (error instanceof TimeoutError) {
                logger.error("Timed out while trying to get item context: " + primeOffer.content.externalURL);
                continue;
            }
            throw error;
        }
        if (!item) {
            continue;
        }

        // Ignore expired rewards
        if (isExpired({
            prime_offer: primeOffer,
            item: item
        })) {
            continue;
        }

        journeyOffersObject[item.id] = {
            prime_offer: primeOffer,
            item: item
        };

    }
    return Object.values(journeyOffersObject);
}

export declare interface Watchdog {
    on(event: "update", listener: (offers: JourneyInfo[]) => void): this;
}

abstract class Database {

    abstract add(journeyInfo: JourneyInfo): boolean;

    abstract remove(journeyInfo: JourneyInfo): boolean;

    abstract contains(journeyInfo: JourneyInfo): boolean;

    abstract all(): JourneyInfo[];

}

class JsonDatabase extends Database {

    #path: string;

    #data: { [key: string]: any } = {};

    constructor(path: string) {
        super();
        this.#path = path;
        if (fs.existsSync(path)) {
            this.#data = JSON.parse(fs.readFileSync(path, {encoding: 'utf-8'}));
        }
        if (!("items" in this.#data)) {
            this.#data["items"] = {};
        }
    }

    add(journeyInfo: JourneyInfo): boolean {
        this.#data["items"][journeyInfo.item.id] = journeyInfo;
        this.#save();
        return false;
    }

    contains(journeyInfo: JourneyInfo): boolean {
        return journeyInfo.item.id in this.#data["items"];
    }

    remove(journeyInfo: JourneyInfo): boolean {
        delete this.#data["items"][journeyInfo.item.id];
        this.#save();
        return false;
    }

    all(): JourneyInfo[] {
        const items = [];
        const f = this.#data["items"];
        for (const item in f) {
            items.push(f[item]);
        }
        return items;
    }

    #save() {
        fs.writeFileSync(this.#path, JSON.stringify(this.#data, null, 4), {encoding: "utf-8"});
    }

}

const isExpired = (journeyInfo: JourneyInfo): boolean => {
    for (const offer of journeyInfo.item.offers) {
        const endTime = Date.parse(offer.endTime);
        if (endTime > new Date().getTime()) {
            return false;
        }
    }
    return true;
};

export type Filter = (journeyInfo: JourneyInfo) => boolean;

export type Options = {
    browser: Browser,
    interval?: number,
    database?: Database,
    filter?: Filter
}

export class Watchdog extends EventEmitter {

    #browser: Browser;

    /**
     * The number of minutes to wait before checking for new offers.
     * @private
     */
    readonly #pollingIntervalMinutes: number = 60;

    #timeoutId: NodeJS.Timeout | null = null;

    #database: Database;

    readonly #filter: Filter = () => {
        return true;
    };

    constructor(options: Options) {
        super();
        this.#browser = options?.browser;
        this.#pollingIntervalMinutes = options?.interval ?? this.#pollingIntervalMinutes;
        this.#database = options?.database ?? new JsonDatabase("database.json");
        this.#filter = options?.filter ?? this.#filter;
    }

    start() {
        if (this.#timeoutId) {
            return;
        }
        const run = () => {
            (async () => {

                // Remove old items from database
                const items = this.#database.all();
                for (const item of items) {
                    if (isExpired(item)) {
                        this.#database.remove(item);
                        logger.info("Removed item from database: " + item.item.id);
                    }
                }

                // Get all prime offers
                logger.info("Fetching prime offers...");
                const primeOffers = await getPrimeOffers(this.#browser);
                logger.info("Found " + primeOffers.length + " offers.");

                // Find new prime offers
                const newPrimeOffers: JourneyInfo[] = [];
                for (const offer of primeOffers) {
                    if (this.#database.contains(offer)) {
                        continue;
                    }
                    if (!this.#filter(offer)) {
                        continue;
                    }
                    newPrimeOffers.push(offer);
                    this.#database.add(offer);
                }
                logger.info("Found " + newPrimeOffers.length + " new offers.");

                // Notify listeners
                this.emit("update", newPrimeOffers);
            })().catch((error) => {
                logger.error(error);
            }).finally(() => {
                logger.info("Checking again in " + this.#pollingIntervalMinutes + " minutes.");
                this.#timeoutId = setTimeout(run, 1000 * 60 * this.#pollingIntervalMinutes);
            });
        };
        run();
    }

    stop() {
        if (this.#timeoutId) {
            clearTimeout(this.#timeoutId);
        }
    }

}
