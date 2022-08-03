import axios from "axios";

import {Notifier} from "./notifier.js";
import {JourneyInfo} from "../watchdog.js";
import logger from "../logger.js";

export interface DiscordRecipient {
    webhook_url: string
}

function chunk<T>(items: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
}

export class DiscordNotifier extends Notifier {

    readonly #recipients: DiscordRecipient[];

    constructor(recipients: DiscordRecipient[]) {
        super();
        this.#recipients = recipients;
    }

    onUpdate(offers: JourneyInfo[]): void {
        for (const recipient of this.#recipients) {
            const embeds = offers.map(offer => {
                return {
                    title: "New Prime Loot",
                    description: `${offer.journey.game.assets.title}\n\n${offer.journey_offer.assets.title}\n*${offer.journey_offer.assets.subtitle}*\n\n[Click here to claim](${offer.prime_offer.content.externalURL})`,
                    thumbnail: {
                        url: offer.journey_offer.assets.card.defaultMedia.src1x
                    }
                };
            });
            // Discord only allows 10 embeds per message
            const chunkedEmbeds = chunk(embeds, 10);
            for (const chunk of chunkedEmbeds) {
                axios.post(recipient.webhook_url, {
                    embeds: chunk
                }).catch(error => {
                    // TODO: Retry failed webhooks
                    logger.error("Failed to send webhook: " + recipient.webhook_url);
                    logger.error(error);
                });
            }
        }
    }

}
