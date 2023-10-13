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

async function sleep(milliseconds: number): Promise<void>{
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export class DiscordNotifier extends Notifier {

    readonly #recipients: DiscordRecipient[];

    constructor(recipients: DiscordRecipient[]) {
        super();
        this.#recipients = recipients;
    }

    #createField(name: string, value: string) {
        return {
            name: name,
            value: value
        };
    }

    onUpdate(offers: JourneyInfo[]): void {
        for (const recipient of this.#recipients) {
            const embeds = offers.map(offer => {
                const fields = [
                    this.#createField("Game", offer.item.game.assets.title),
                    this.#createField("Title", offer.prime_offer.title),
                ];
                if (!offer.item.isFGWP) {
                    fields.push(this.#createField("Rewards", offer.item.assets.itemDetails.join("\n")));
                }
                return {
                    title: "New Prime Loot",
                    fields: fields,
                    description: `[Click here to claim](${offer.prime_offer.content.externalURL})`,
                    thumbnail: {
                        url: offer.item.game.assets.coverArt.defaultMedia.src1x
                    }
                };
            });

            const send = async () => {
                // Discord only allows 10 embeds per message
                const chunkedEmbeds = chunk(embeds, 10);
                for (const chunk of chunkedEmbeds) {
                    try {
                        await axios.post(recipient.webhook_url, {
                            embeds: chunk
                        });
                        await sleep(1000);
                    } catch (exception) {
                        // TODO: Retry failed webhooks
                        logger.error("Failed to send webhook: " + recipient.webhook_url);
                        logger.error(exception);
                    }
                }
            };

            send();
        }
    }

}
