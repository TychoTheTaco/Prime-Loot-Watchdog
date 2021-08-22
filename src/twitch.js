'use strict';

module.exports = {

    getPrimeOffers: async (browser) => {
        const page = await browser.newPage();
        await page.goto('https://gaming.amazon.com/home');
        const response = await page.waitForResponse(response => {
            return (response.url().startsWith('https://gaming.amazon.com/graphql?') && JSON.parse(response.request().postData())['operationName'] === 'OffersContext_WithEligibilityAndCode_Offers');
        });
        const primeOffers = (await response.json())['data']['primeOffers'];
        await page.close();
        return primeOffers;
    },

    getJourney: async (browser, offer) => {
        const page = await browser.newPage();
        await page.goto(offer['content']['externalURL']);
        const response = await page.waitForResponse(response => {
            return (response.url().startsWith('https://gaming.amazon.com/graphql?') && JSON.parse(response.request().postData())['operationName'] === 'OfferDetail_Journey_With_Eligibility_OrderInformation');
        });
        const journey = (await response.json())['data']['journey'];
        await page.close();
        return journey;
    }

}
