<script>
    import { onMount } from 'svelte';
    import { Bar } from 'svelte-chartjs';
    import { Chart, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js';

    Chart.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

    let tickers = '';
    let chartData = {
        labels: [],
        datasets: [{
            label: 'Capital Efficiency',
            data: [],
            backgroundColor: 'rgba(53, 162, 235, 0.8)',
            borderColor: 'rgba(53, 162, 235, 1)',
            borderWidth: 1
        }]
    };

    let chartOptions = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Top 20 Capital Efficient Options',
                font: {
                    size: 18
                }
            }
        },
        scales: {
            x: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Capital Efficiency'
                }
            },
            y: {
                ticks: {
                    autoSkip: false,
                    maxRotation: 0,
                    minRotation: 0
                }
            }
        }
    };

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
            const data = await response.json();

            if (data.length === 0) {
                throw new Error("No data received from the server");
            }

            chartData.labels = data.map(item => `${item.symbol} ${item.strike}$ ${item.type} ${item.expiration}`);
            chartData.datasets[0].data = data.map(item => item.capitalEfficiency);
            
            chartData = {...chartData};
        } catch (e) {
            console.error("Error fetching data:", e);
            error = e.message;
        } finally {
            isLoading = false;
        }
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
            <Bar data={chartData} options={chartOptions} />
        </div>
    {:else if !isLoading}
        <p class="no-data">No data to display. Please enter tickers and fetch data.</p>
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
    }

    .error {
        color: #e74c3c;
        text-align: center;
        font-weight: bold;
    }

    .no-data {
        text-align: center;
        color: #7f8c8d;
        font-style: italic;
    }
</style>