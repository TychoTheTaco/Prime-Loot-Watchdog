'use strict';

const fs = require("fs");

const nodemailer = require("nodemailer");
const ejs = require("ejs");

const {Service} = require('./service');


module.exports = {

    EmailService: class extends Service {

        constructor(config) {
            super();
            this._config = config;

            this._transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: config['from']['address'],
                    pass: config['from']['password']
                }
            });

            // Load email template
            this._template = fs.readFileSync('./src/templates/email.ejs', {encoding: 'utf-8'});

            // Map of emails to list of journey offer IDs. This keeps track of which offers we have already send emails for.
            this._sent_journey_offer_ids = {};
        }

        onUpdate(journey_offers) {
            for (const recipient of this._config['to']) {

                if (!(recipient in this._sent_journey_offer_ids)) {
                    this._sent_journey_offer_ids[recipient] = new Set();
                }

                // Prepare journeys
                const journeys = {};
                for (const offer of journey_offers) {
                    const journeyOffer = offer['journey_offer'];
                    const journeyOfferId = journeyOffer['id'];

                    // Skip this offer if we already emailed it to this recipient
                    if (this._sent_journey_offer_ids[recipient].has(journeyOfferId)) {
                        continue;
                    }

                    const journeyId = offer['journey']['id'];
                    if (!(journeyId in journeys)) {
                        journeys[journeyId] = {'journey': offer['journey'], 'offers': []};
                    }
                    journeys[journeyId]['offers'].push({
                        'id': journeyOfferId,
                        'title': journeyOffer['assets']['title'],
                        'subtitle': journeyOffer['assets']['subtitle'],
                        'image': journeyOffer['assets']['card']['defaultMedia']['src1x'],
                        'url': offer['prime_offer']['content']['externalURL']
                    });
                }

                // Make sure we still have offers to send
                if (Object.keys(journeys).length === 0){
                    continue;
                }

                const mailOptions = {
                    from: this._config['from']['address'],
                    to: recipient,
                    subject: 'New Twitch Prime Rewards!',
                    html: ejs.render(this._template, {'journeys': journeys})
                };

                this._transporter.sendMail(mailOptions).then((result) => {
                    console.log('Sent email to', recipient)

                    for (const journey of Object.values(journeys)) {
                        for (const offer of journey['offers']) {
                            this._sent_journey_offer_ids[recipient].add(offer['id']);
                        }
                    }

                }).catch((error) => {
                    console.error(error);
                    console.error('Failed to send email to', recipient);
                });
            }
        }

    }

}
