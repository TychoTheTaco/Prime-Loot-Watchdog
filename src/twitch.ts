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

interface MediaAsset {
    src1x: string,
    src2x: string,
    type: "IMAGE" | string
}

export interface Game {
    id: string,
    assets: {
        title: string
        coverArt: {
            defaultMedia: MediaAsset
        }
    }
}

export interface Item {
    id: string,
    assets: {
        itemDetails: [string],
        thumbnailImage: {
            defaultMedia: MediaAsset
        }
    },
    game: Game,
    isFGWP: boolean,  // "Free Games With Prime"
    offers: [{
        id: string,
        startTime: string,
        endTime: string;
    }]
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

export class Client {

    #browser: Browser;

    constructor(browser: Browser) {
        this.#browser = browser;
    }

    async getPrimeOffers(): Promise<PrimeOffer[]> {
        const page = await this.#browser.newPage();
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
            return (await response.json())['data']['primeOffers'];
        } finally {
            await page.close();
        }
    }

    async getItemContext(offer: PrimeOffer): Promise<Item> {
        const page = await this.#browser.newPage();
        try {
            await page.goto(offer.content.externalURL);
            const response = await page.waitForResponse(response => {
                if (response.url().startsWith('https://gaming.amazon.com/graphql?')) {
                    const data = response.request().postData();
                    if (data) {
                        const payload = JSON.parse(data) as GQLRequestPayload;
                        if (payload.operationName === "ItemContext") {
                            return true;
                        }
                    }
                }
                return false;
            }, {timeout: 10 * 1000});
            return (await response.json())["data"]["item"];
        } finally {
            await page.close();
        }
    }

}
