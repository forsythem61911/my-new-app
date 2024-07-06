import { json } from '@sveltejs/kit';
import axios from 'axios';

export async function GET({ url }) {
    console.log("GET request received");
    const symbols = url.searchParams.get('symbols').split(',');
    console.log("Symbols:", symbols);
    const apiKey = 'TJ48CALH56ATBWAN'; // Replace with your actual premium API key
    const functionName = 'TIME_SERIES_DAILY';
    const optionsFunctionName = 'HISTORICAL_OPTIONS';

    let allCapitalEfficiencyData = [];
    const dataDate = getPreviousTradingDay();

    for (const symbol of symbols) {
        console.log(`Processing symbol: ${symbol}`);
        
        const optionsResult = await fetchOptionsData(symbol, apiKey, optionsFunctionName, dataDate);
        if (!optionsResult) {
            console.log(`No valid options data for ${symbol}. Skipping.`);
            continue;
        }
        console.log(`Options data received for ${symbol}`);

        const { optionsData } = optionsResult;

        const stockPrice = await fetchStockPrice(symbol, apiKey, dataDate);
        if (!stockPrice) {
            console.log(`No valid stock price for ${symbol}. Skipping.`);
            continue;
        }
        console.log(`Stock price for ${symbol}: ${stockPrice}`);

        const capitalEfficiencyData = calculateCapitalEfficiency(optionsData, stockPrice, symbol);
        allCapitalEfficiencyData = allCapitalEfficiencyData.concat(capitalEfficiencyData);
    }

    // Filter out options that expire on the same date as the data date
    const filteredData = allCapitalEfficiencyData.filter(item => item.expiration !== dataDate);

    // Separate calls and puts
    const calls = filteredData.filter(option => option.type === 'call');
    const puts = filteredData.filter(option => option.type === 'put');

    // Sort and slice the top 20 for each type
    calls.sort((a, b) => b.expectedAnnualizedReturn - a.expectedAnnualizedReturn);
    puts.sort((a, b) => b.expectedAnnualizedReturn - a.expectedAnnualizedReturn);

    const top20Calls = calls.slice(0, 20);
    const top20Puts = puts.slice(0, 20);

    console.log("Data being sent to frontend:", { top20Calls, top20Puts, dataDate });
    return json({ top20Calls, top20Puts, dataDate });
}

function getPreviousTradingDay() {
    const today = new Date();
    let previousDay = new Date(today);

    do {
        previousDay.setDate(previousDay.getDate() - 1);
    } while (previousDay.getDay() === 0 || previousDay.getDay() === 6);

    return previousDay.toISOString().split('T')[0]; // Returns date in YYYY-MM-DD format
}

async function fetchStockPrice(symbol, apiKey, date) {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}`;
    try {
        console.log(`Fetching stock price for ${symbol} on ${date}`);
        const response = await axios.get(url);
        const data = response.data;
        if ('Time Series (Daily)' in data) {
            const priceData = data['Time Series (Daily)'][date];
            return priceData ? parseFloat(priceData['4. close']) : null;
        } else {
            console.log(`Unexpected data structure for ${symbol}:`, data);
        }
    } catch (error) {
        console.error(`Error fetching stock price for ${symbol}:`, error.response ? error.response.data : error.message);
    }
    return null;
}

async function fetchOptionsData(symbol, apiKey, functionName, date) {
    const url = `https://www.alphavantage.co/query?function=${functionName}&symbol=${symbol}&date=${date}&apikey=${apiKey}`;
    try {
        console.log(`Fetching options data for ${symbol} on ${date}`);
        const response = await axios.get(url);
        const data = response.data;
        
        return {
            optionsData: data.option_chain || data.data,
        };
    } catch (error) {
        console.error(`Error fetching options data for ${symbol}:`, error.response ? error.response.data : error.message);
    }
    return null;
}

function calculateCapitalEfficiency(optionsData, stockPrice, symbol) {
    const riskFreeRate = 0.05; // Assume 5% risk-free rate, adjust as needed

    return optionsData.map(option => {
        const strikePrice = parseFloat(option.strike);
        const midpoint = (parseFloat(option.bid) + parseFloat(option.ask)) / 2;
        const optionType = option.type;
        const expirationDate = new Date(option.expiration);
        const delta = parseFloat(option.delta);

        const daysTillExpiration = Math.max(1, (expirationDate - new Date()) / (1000 * 60 * 60 * 24));
        const annualizedTime = daysTillExpiration / 365;

        let capitalRequired, maxLoss, potentialProfit;

        if (optionType === 'call') {
            capitalRequired = 100 * stockPrice; // Assuming cash-secured calls
            maxLoss = Math.max(1, (stockPrice - strikePrice) * 100);
            potentialProfit = midpoint * 100;
        } else { // put option
            capitalRequired = 100 * strikePrice;
            maxLoss = Math.max(1, strikePrice * 100); // Maximum loss if stock goes to zero
            potentialProfit = midpoint * 100;
        }

        // Probability of profit (corrected calculation)
        const probOfProfit = optionType === 'call' ? (1 - Math.abs(delta)) : (1 + delta);

        // Annualized return on capital
        const annualizedReturn = (potentialProfit / capitalRequired) * (1 / annualizedTime);

        // Expected annualized return (annualized return * probability of profit)
        const expectedAnnualizedReturn = annualizedReturn * probOfProfit * 100;

        // Risk-adjusted return
        const excessReturn = Math.max(0, annualizedReturn - riskFreeRate);
        const riskAdjustedReturn = excessReturn / (maxLoss / capitalRequired);

        // Capital efficiency score
        const capitalEfficiency = riskAdjustedReturn * probOfProfit * Math.sqrt(annualizedTime);

        return {
            contractID: option.contractID,
            type: optionType,
            strike: strikePrice,
            capitalEfficiency: capitalEfficiency,
            expectedAnnualizedReturn: expectedAnnualizedReturn,
            probOfProfit: probOfProfit,
            expiration: option.expiration,
            symbol,
            premium: midpoint,
            delta: delta,
            stockPrice: stockPrice,
            bid: parseFloat(option.bid),
            ask: parseFloat(option.ask)
        };
    });
}
