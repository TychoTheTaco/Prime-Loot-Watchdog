import {Browser} from "puppeteer";

interface GQLRequestPayload {
    extensions: any,
    operationName: string,
    query: string,
    variables: any
}

export interface PrimeOffer {
    content: {
        externalURL: string
    },
    deliveryMethod: "EXTERNAL_OFFER" | "DIRECT_ENTITLEMENT" | string,
    title: string,
    id: string
}

export async function getPrimeOffers(browser: Browser): Promise<PrimeOffer[]> {
    const page = await browser.newPage();
    try {
        await page.goto('https://gaming.amazon.com/home');
        const response = await page.waitForResponse(response => {
            if (response.url().startsWith('https://gaming.amazon.com/graphql?')) {
                const data = response.request().postData();
                if (data) {
                    const payload = JSON.parse(data) as GQLRequestPayload;
                    if (payload.operationName.startsWith("OffersContext_Offers")) {
                        return true;
                    }
                }
            }
            return false;
        });
        const primeOffers = (await response.json())['data']['primeOffers'];
        await page.close();
        return primeOffers;
    } finally {
        await page.close();
    }
}

export interface Journey {
    id: string,
    offers: [JourneyOffer],
    game: {
        id: string,
        assets: {
            title: string
        }
    }
}

export interface JourneyOffer {
    id: string,
    catalogId: string,
    self: {
        claimStatus: "AVAILABLE" | string
    },
    assets: {
        title: string,
        subtitle: string,
        card: {
            defaultMedia: {
                src1x: string
            }
        }
    }
}

export async function getJourney(browser: Browser, offer: PrimeOffer): Promise<Journey> {
    const page = await browser.newPage();
    try {
        await page.goto(offer.content.externalURL);
        const response = await page.waitForResponse(response => {
            if (response.url().startsWith('https://gaming.amazon.com/graphql?')) {
                const data = response.request().postData();
                if (data) {
                    const payload = JSON.parse(data) as GQLRequestPayload;
                    if (payload.operationName.startsWith("OfferDetail_Journey")) {
                        return true;
                    }
                }
            }
            return false;
        });
        const journey = (await response.json())['data']['journey'];
        await page.close();
        return journey;
    } finally {
        await page.close();
    }
}

export default {
    getPrimeOffers, getJourney
};
