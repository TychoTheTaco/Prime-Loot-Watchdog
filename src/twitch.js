'use strict';

module.exports = {

    getPrimeOffers: async (browser) => {
        const page = await browser.newPage();
        await page.goto('https://gaming.amazon.com/home');
        const response = await page.waitForResponse(response => {
            if (response.url().startsWith('https://gaming.amazon.com/graphql?')) {
                const operationName = JSON.parse(response.request().postData())['operationName'];
                if (['OffersContext_Offers', 'OffersContext_Offers_And_Items'].includes(operationName)) {
                    return true;
                }
            }
            return false;
        });
        const primeOffers = (await response.json())['data']['primeOffers'];
        await page.close();
        return primeOffers;
    },

    getJourney: async (browser, offer) => {
        const page = await browser.newPage();
        await page.goto(offer['content']['externalURL']);
        const response = await page.waitForResponse(response => {
            if (response.url().startsWith('https://gaming.amazon.com/graphql?')){
                const operationName = JSON.parse(response.request().postData())['operationName'];
                if (['OfferDetail_Journey', 'OfferDetail_Journey_With_Eligibility_OrderInformation', 'OfferDetail_Journey_With_Eligibility_OrderInformation_Notifications'].includes(operationName)) {
                    return true;
                }
            }
        });
        const journey = (await response.json())['data']['journey'];
        await page.close();
        return journey;
    }

}
