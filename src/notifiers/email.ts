import fs from "node:fs";

import nodemailer, {Transporter} from "nodemailer";
import ejs from "ejs";

import {Notifier} from "./notifier.js";
import {JourneyInfo} from "../watchdog.js";
import logger from "../logger.js";

export class EmailNotifier extends Notifier {

    readonly #user: string;

    readonly #recipients: string[];

    #transporter: Transporter;

    readonly #template: string;

    constructor(user: string, password: string, recipients: string[] = []) {
        super();
        this.#user = user;
        this.#recipients = recipients;

        this.#transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: user,
                pass: password
            }
        });

        // Load email template
        this.#template = fs.readFileSync('./src/templates/email.ejs', {encoding: 'utf-8'});
    }

    onUpdate(offers: JourneyInfo[]) {
        for (const recipient of this.#recipients) {

            // Prepare journeys
            const journeys: { [key: string]: any } = {};
            for (const offer of offers) {
                journeys[offer.item.id]['offers'].push({
                    'id': offer.item.id,
                    'title': "journeyOffer['assets']['title']",
                    'subtitle': "journeyOffer['assets']['subtitle']",
                    'image': "journeyOffer['assets']['card']['defaultMedia']['src1x']",
                    'url': offer['prime_offer']['content']['externalURL']
                });
            }

            // Make sure we still have offers to send
            if (Object.keys(journeys).length === 0) {
                continue;
            }

            const mailOptions = {
                from: this.#user,
                to: recipient,
                subject: 'New Twitch Prime Rewards!',
                html: ejs.render(this.#template, {'journeys': journeys})
            };

            this.#transporter.sendMail(mailOptions).then((result: any) => {
                logger.info("Sent email to " + recipient);
            }).catch((error: any) => {
                // TODO: Retry failed emails
                logger.error("Failed to send email to " + recipient);
                logger.error(error);
            });
        }
    }

}
