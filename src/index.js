'use strict';

const fs = require("fs");

const {ArgumentParser} = require("argparse");
const puppeteer = require("puppeteer-extra");

const twitch = require('./twitch');
const {EmailService} = require('./services/email');

function loadConfigFile(file_path) {
    if (fs.existsSync(file_path)) {
        try {
            return JSON.parse(fs.readFileSync(file_path, {encoding: 'utf-8'}));
        } catch (error) {
            console.error('Failed to read config file!');
            console.error(error);
            process.exit(1);
        }
    } else {
        console.error('No config file found!');
        process.exit(1);
    }
}

async function getPrimeOffers(browser) {
    const primeOffers = await twitch.getPrimeOffers(browser);

    const journeyOffersObject = {};
    for (const primeOffer of primeOffers) {

        if (primeOffer['deliveryMethod'] === 'EXTERNAL_OFFER') {

            // Ignore Luna offers
            if (primeOffer['content']['externalURL'].startsWith('https://www.amazon.com/luna')){
                continue;
            }

            const journey = await twitch.getJourney(browser, primeOffer);

            for (const journeyOffer of journey['offers']) {

                // Ignore offers that are not available
                if (journeyOffer['self']['claimStatus'] !== 'AVAILABLE') {
                    continue;
                }

                const journeyOfferId = journeyOffer['id'];
                if (!(journeyOfferId in journeyOffersObject)) {
                    journeyOffersObject[journeyOfferId] = {'journey': journey, 'journey_offer': journeyOffer, 'prime_offer': primeOffer};
                }
            }
        }
    }
    return Object.values(journeyOffersObject);
}

// Parse arguments
const parser = new ArgumentParser();
parser.add_argument('--config', '-c', {default: 'config.json'});
const args = parser.parse_args();

// Load config file
const config = loadConfigFile(args['config']);

// Create services
const services = [
    new EmailService(config['email'])
];

(async () => {

    const browser = await puppeteer.launch();

    const run = () => {
        (async () => {
            console.log('Fetching prime offers...');
            const primeOffers = await getPrimeOffers(browser);
            console.log('Found', primeOffers.length, 'offers.');

            for (const service of services) {
                service.onUpdate(primeOffers);
            }
        })().catch((error) => {
            console.error(error);
        }).finally(() => {
            console.log('Checking again in', config['watchdog']['interval'], 'minutes.');
            setTimeout(run, 1000 * 60 * config['watchdog']['interval']);
        });
    };
    run();

})().catch((error) => {
    console.error(error);
    process.exit(1);
});
