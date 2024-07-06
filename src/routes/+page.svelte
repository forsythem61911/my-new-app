<script>
    import { onMount } from 'svelte';
    import { Bar } from 'svelte-chartjs';
    import { Chart, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, SubTitle } from 'chart.js';
    import ProfitCurveChart from './ProfitCurveChart.svelte';

    Chart.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, SubTitle);

    let tickers = '';
    let selectedOption = null;
    let showCalls = true; // Toggle switch state
    let callsData = [];
    let putsData = [];
    let dataDate = '';
    let chartData = {
        labels: [],
        datasets: [{
            label: 'Expected Annualized Return',
            data: [],
            backgroundColor: 'rgba(53, 162, 235, 0.8)',
            borderColor: 'rgba(53, 162, 235, 1)',
            borderWidth: 1
        }]
    };

    $: chartOptions = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            title: {
                display: true,
                text: 'Top 20 Options by Expected Annualized Return',
                font: {
                    size: 18
                }
            },
            subtitle: {
                display: true,
                text: '', // We'll set this dynamically
                font: {
                    size: 14
                }
            },
            // Disable all other plugins
            tooltip: false,
            datalabels: false,
            annotation: false,
            verticalLine: false,
            horizontalLine: false
        },
        parsing: {
            xAxisKey: 'y',
            yAxisKey: 'contractIndex'
        },
        scales: {
            x: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Expected Annualized Return (%)',
                    font: {
                        size: 14
                    }
                },
                ticks: {
                    callback: function(value) {
                        return value.toFixed(2) + '%';
                    }
                }
            },
            y: {
                ticks: {
                    autoSkip: false,
                    maxRotation: 0,
                    minRotation: 0
                }
            }
        },
        onClick: (event, elements, chart) => {
            if (elements && elements.length > 0) {
                const clickedElement = elements[0];
                const datasetIndex = clickedElement.datasetIndex;
                const index = clickedElement.index;
                const clickedData = chart.data.datasets[datasetIndex].data[index];
                
                if (clickedData && typeof clickedData.contractIndex !== 'undefined') {
                    const contractIndex = clickedData.contractIndex;
                    selectedOption = chart.data.datasets[datasetIndex].originalData[contractIndex];
                    console.log('Selected option:', selectedOption);
                } else {
                    console.error('Clicked data does not have a contractIndex');
                }
            } else {
                console.log('No element clicked');
            }
        },
    };

    $: if (callsData.length && putsData.length) {
        const dataToShow = showCalls ? callsData : putsData;
        chartData = {
            labels: dataToShow.map(item => `${item.symbol} ${item.strike}$ ${item.type} ${item.expiration}`),
            datasets: [{
                label: 'Expected Annualized Return',
                data: dataToShow.map((item, index) => ({
                    y: item.expectedAnnualizedReturn,
                    contractIndex: index
                })),
                originalData: dataToShow,
                backgroundColor: 'rgba(53, 162, 235, 0.8)',
                borderColor: 'rgba(53, 162, 235, 1)',
                borderWidth: 1
            }]
        };

        chartOptions = {
            ...chartOptions,
            plugins: {
                ...chartOptions.plugins,
                subtitle: {
                    ...chartOptions.plugins.subtitle,
                    text: `Data as of ${dataDate}`
                }
            }
        };
    }

    let isLoading = false;
    let error = null;

    async function fetchData() {
        if (!tickers.trim()) {
            alert('Please enter at least one ticker');
            return;
        }
        
        isLoading = true;
        error = null;

        try {
            const symbols = tickers.split(',').map(s => s.trim().toUpperCase());
            const response = await fetch(`/api/stock-data?symbols=${symbols.join(',')}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const { top20Calls, top20Puts, dataDate: date } = await response.json();

            if (top20Calls.length === 0 && top20Puts.length === 0) {
                throw new Error("No data received from the server");
            }

            callsData = top20Calls;
            putsData = top20Puts;
            dataDate = date;

            console.log('Updated callsData:', callsData);
            console.log('Updated putsData:', putsData);
        } catch (e) {
            console.error("Error fetching data:", e);
            error = e.message;
        } finally {
            isLoading = false;
        }
    }

    function toggleData() {
        showCalls = !showCalls;
    }
</script>

<main>
    <h1>Stock Options Capital Efficiency</h1>

    <div class="input-container">
        <input 
            id="tickers" 
            bind:value={tickers} 
            placeholder="Enter stock tickers (e.g. AAPL, MSFT, GOOGL)"
            disabled={isLoading}
        >
        <button on:click={fetchData} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Fetch Data'}
        </button>
    </div>

    {#if error}
        <p class="error">{error}</p>
    {/if}

    {#if chartData.labels.length > 0}
        <div class="chart-container">
            <div class="toggle-switch">
                <label>
                    <span class="show-puts">Puts</span>
                    <input type="checkbox" on:change={toggleData} checked={showCalls} />
                    <span class="slider"></span>
                    <span class="show-calls">Calls</span>
                </label>
            </div>
            <Bar data={chartData} options={chartOptions} />
        </div>
    {:else if !isLoading}
        <p class="no-data">No data to display. Please enter tickers and fetch data.</p>
    {/if}

    {#if selectedOption}
        <div class="profit-curve-container">
            <ProfitCurveChart optionData={selectedOption} />
        </div>
    {/if}
</main>

<style>
    :global(body) {
        font-family: Arial, sans-serif;
        background-color: #f0f4f8;
        margin: 0;
        padding: 0;
    }

    main {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
    }

    h1 {
        color: #2c3e50;
        text-align: center;
        margin-bottom: 30px;
    }

    .input-container {
        display: flex;
        justify-content: center;
        margin-bottom: 20px;
    }

    input {
        width: 300px;
        padding: 10px;
        font-size: 16px;
        border: 1px solid #bdc3c7;
        border-radius: 4px 0 0 4px;
    }

    button {
        padding: 10px 20px;
        font-size: 16px;
        background-color: #3498db;
        color: white;
        border: none;
        border-radius: 0 4px 4px 0;
        cursor: pointer;
        transition: background-color 0.3s;
    }

    button:hover {
        background-color: #2980b9;
    }

    button:disabled {
        background-color: #bdc3c7;
        cursor: not-allowed;
    }

    .chart-container {
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        padding: 20px;
        margin-top: 20px;
        height: 600px;
        position: relative;
    }

    .error {
        color: #ff4a46;
        text-align: center;
        font-weight: bold;
    }

    .no-data {
        text-align: center;
        color: #7f8c8d;
        font-style: italic;
    }

    .profit-curve-container {
        margin-top: 20px;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        padding: 20px;
    }

    .toggle-switch {
        position: absolute;
        bottom: 20px;
        left: 20px;
        display: flex;
        align-items: center;
    }

    .toggle-switch label {
        display: flex;
        align-items: center;
    }

    .toggle-switch input {
        display: none;
    }

    .toggle-switch .slider {
        width: 40px;
        height: 20px;
        background-color: #ff4a46;
        border-radius: 20px;
        position: relative;
        cursor: pointer;
        transition: background-color 0.2s;
        margin: 0 10px;
    }

    .toggle-switch .slider::before {
        content: '';
        position: absolute;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background-color: white;
        top: 50%;
        left: 2px;
        transform: translateY(-50%);
        transition: left 0.2s;
    }

    .toggle-switch input:checked + .slider {
        background-color: #56b8b7;
    }

    .toggle-switch input:checked + .slider::before {
        left: 22px;
        color: #ff4a46;
    }

    .toggle-switch input:checked + .slider + .show-calls {
        color: #000000;
    }

    .toggle-switch .show-puts,
    .toggle-switch .show-calls {
        font-size: 14px;
        color: #333;
    }

    .toggle-switch .show-puts {
        margin-right: 1px;
    }
</style>
