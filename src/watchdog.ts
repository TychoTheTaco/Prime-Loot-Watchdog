import {EventEmitter} from "node:events";

import puppeteer, {Browser} from "puppeteer";

const TimeoutError = puppeteer.errors.TimeoutError;

import twitch, {Journey, JourneyOffer, PrimeOffer} from "./twitch.js";
import logger from "./logger.js";

export interface JourneyInfo {
    journey: Journey,
    journey_offer: JourneyOffer,
    prime_offer: PrimeOffer
}

export async function getPrimeOffers(browser: Browser): Promise<JourneyInfo[]> {
    const primeOffers = await twitch.getPrimeOffers(browser);

    const journeyOffersObject: { [key: string]: JourneyInfo } = {};
    for (const primeOffer of primeOffers) {

        if (primeOffer.deliveryMethod != "EXTERNAL_OFFER") {
            logger.info("Ignoring non external offer: " + primeOffer.id + " " + primeOffer.title);
            continue;
        }

        // Ignore Luna offers
        if (primeOffer.content.externalURL.startsWith('https://www.amazon.com/luna')) {
            logger.info("Ignoring luna offer: " + primeOffer.id + " " + primeOffer.title);
            continue;
        }

        // Get the Journey details for this Prime offer
        let journey;
        try {
            journey = await twitch.getJourney(browser, primeOffer);
        } catch (error) {
            if (error instanceof TimeoutError) {
                logger.error("Timeout when getting journey from URL: " + primeOffer.content.externalURL);
                continue;
            }
            throw error;
        }

        for (const journeyOffer of journey.offers) {

            // Ignore offers that are not available to claim
            if (journeyOffer.self.claimStatus !== 'AVAILABLE') {
                continue;
            }

            const journeyOfferId = journeyOffer.id;
            if (!(journeyOfferId in journeyOffersObject)) {
                journeyOffersObject[journeyOfferId] = {'journey': journey, 'journey_offer': journeyOffer, 'prime_offer': primeOffer};
            }
        }
    }
    return Object.values(journeyOffersObject);
}

export declare interface Watchdog {
    on(event: "update", listener: (offers: JourneyInfo[]) => void): this;
}

export class Watchdog extends EventEmitter {

    #browser: Browser;

    /**
     * The number of minutes to wait before checking for new offers.
     * @private
     */
    readonly #pollingIntervalMinutes: number;

    #timeoutId: NodeJS.Timeout | null = null;

    readonly #offerIds: Set<string> = new Set<string>();

    constructor(browser: Browser, interval: number) {
        super();
        this.#browser = browser;
        this.#pollingIntervalMinutes = interval;
    }

    start() {
        if (!this.#timeoutId) {
            const run = () => {
                (async () => {
                    // Get all prime offers
                    logger.info("Fetching prime offers...");
                    const primeOffers = await getPrimeOffers(this.#browser);
                    logger.info("Found " + primeOffers.length + " offers.");

                    // Find new prime offers
                    const newPrimeOffers: JourneyInfo[] = [];
                    for (const offer of primeOffers) {
                        const offerId = offer.journey_offer.id;
                        if (this.#offerIds.has(offerId)) {
                            continue;
                        }
                        newPrimeOffers.push(offer);
                        this.#offerIds.add(offerId);
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
    }

    stop() {
        if (this.#timeoutId) {
            clearTimeout(this.#timeoutId);
        }
    }

}
