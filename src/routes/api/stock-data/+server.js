import { json } from '@sveltejs/kit';
import axios from 'axios';

export async function GET({ url }) {
    console.log("GET request received");
    const symbols = url.searchParams.get('symbols').split(',');
    console.log("Symbols:", symbols);
    const apiKey = 'TJ48CALH56ATBWAN'; // Replace with your actual premium API key
    const functionName = 'HISTORICAL_OPTIONS';
    const date = '2024-05-08'; // Use the most recent date available in the historical data

    let allCapitalEfficiencyData = [];

    for (const symbol of symbols) {
        console.log(`Processing symbol: ${symbol}`);
        const stockPrice = await fetchStockPrice(symbol, apiKey);
        if (!stockPrice) {
            console.log(`No valid stock price for ${symbol}. Skipping.`);
            continue;
        }
        console.log(`Stock price for ${symbol}: ${stockPrice}`);

        const optionsData = await fetchOptionsData(symbol, apiKey, functionName, date);
        if (!optionsData) {
            console.log(`No valid options data for ${symbol}. Skipping.`);
            continue;
        }
        console.log(`Options data received for ${symbol}`);

        const capitalEfficiencyData = calculateCapitalEfficiency(optionsData, stockPrice, symbol);
        allCapitalEfficiencyData = allCapitalEfficiencyData.concat(capitalEfficiencyData);
    }

    // Sort and slice the top 20
    allCapitalEfficiencyData.sort((a, b) => b.capitalEfficiency - a.capitalEfficiency);
    const top20Data = allCapitalEfficiencyData.slice(0, 20);

    console.log("Returning data:", top20Data);
    return json(top20Data);
}
async function fetchStockPrice(symbol, apiKey) {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min&apikey=${apiKey}`;
    try {
        console.log(`Fetching stock price for ${symbol}`);
        const response = await axios.get(url);
        console.log(`Full response for ${symbol}:`, JSON.stringify(response.data, null, 2));
        const data = response.data;
        if ('Time Series (5min)' in data) {
            const latestTimestamp = Object.keys(data['Time Series (5min)']).sort().pop();
            return parseFloat(data['Time Series (5min)'][latestTimestamp]['4. close']);
        } else {
            console.log(`Unexpected data structure for ${symbol}:`, data);
        }
    } catch (error) {
        console.error(`Error fetching stock price for ${symbol}:`, error.response ? error.response.data : error.message);
    }
    return null;
}

async function fetchOptionsData(symbol, apiKey, functionName, date) {
    const url = `https://www.alphavantage.co/query?function=${functionName}&symbol=${symbol}&apikey=${apiKey}&date=${date}`;
    try {
        console.log(`Fetching options data for ${symbol}`);
        const response = await axios.get(url);
        console.log(`Options data response for ${symbol}:`, JSON.stringify(response.data, null, 2));
        const data = response.data;
        return data.option_chain || data.data;
    } catch (error) {
        console.error(`Error fetching options data for ${symbol}:`, error.response ? error.response.data : error.message);
    }
    return null;
}

function calculateCapitalEfficiency(optionsData, stockPrice, symbol) {
    return optionsData.map(option => {
        const strikePrice = parseFloat(option.strike);
        const lastPrice = parseFloat(option.last);
        const optionType = option.type;
        const expirationDate = new Date(option.expiration);
        const delta = parseFloat(option.delta);

        let capitalRequired, adjustedCapitalEfficiency;
        if (optionType === 'call') {
            capitalRequired = 100 * stockPrice;
            adjustedCapitalEfficiency = (lastPrice / capitalRequired) * 100 / ((expirationDate - new Date()) / (1000 * 60 * 60 * 24)) * (1 - delta);
        } else { // put option
            capitalRequired = 100 * strikePrice;
            adjustedCapitalEfficiency = (lastPrice / capitalRequired) * 100 / ((expirationDate - new Date()) / (1000 * 60 * 60 * 24)) * delta;
        }

        return {
            contractID: option.contractID,
            type: optionType,
            strike: strikePrice,
            capitalEfficiency: adjustedCapitalEfficiency,
            expiration: option.expiration,
            symbol
        };
    });
}