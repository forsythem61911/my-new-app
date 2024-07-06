<script>
    import { onMount } from 'svelte';
    import { Chart, LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend } from 'chart.js';
    import { Line } from 'svelte-chartjs';

    Chart.register(LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend);
    
    export let optionData;
    
    let chartData;
    let chartOptions;
    
    function generatePriceRange(stockPrice, strike) {
        const min = Math.min(stockPrice, strike) * 0.7;
        const max = Math.max(stockPrice, strike) * 1.3;
        const step = (max - min) / 100;
        return Array.from({length: 101}, (_, i) => min + i * step);
    }
    
    function calculateProfitCurve(priceRange, type, strike, premium) {
        return priceRange.map(price => {
            if (type === 'call') {
                return premium * 100 - Math.max(0, price - strike) * 100;
            } else {
                return premium * 100 - Math.max(0, strike - price) * 100;
            }
        });
    }

    $: if (optionData) {
        const { type, strike, premium, stockPrice } = optionData;
        const priceRange = generatePriceRange(stockPrice, strike);
        const profitData = calculateProfitCurve(priceRange, type, strike, premium);

        chartData = {
            labels: priceRange,
            datasets: [
                {
                    label: 'Profit/Loss',
                    data: profitData,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0
                }
            ]
        };

        chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Profit Curve for ${type.toUpperCase()} ${strike} (${optionData.symbol})`
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += '$' + context.parsed.y.toFixed(2);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Stock Price'
                    },
                    ticks: {
                        callback: function(value, index, values) {
                            return '$' + value.toFixed(2);
                        }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Profit/Loss'
                    },
                    ticks: {
                        callback: function(value, index, values) {
                            return '$' + value.toFixed(2);
                        }
                    }
                }
            }
        };
    }

    onMount(() => {
        const horizonalLine = {
            id: 'horizontalLine',
            beforeDraw(chart, args, options) {
                const { ctx, chartArea: {top, bottom, left, right}, scales: {x, y} } = chart;
                ctx.save();
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(left, y.getPixelForValue(0));
                ctx.lineTo(right, y.getPixelForValue(0));
                ctx.stroke();
                ctx.restore();
            }
        };

        const verticalLine = {
            id: 'verticalLine',
            beforeDraw(chart, args, options) {
                if (optionData) {
                    const { ctx, chartArea: {top, bottom}, scales: {x, y} } = chart;
                    const stockPrice = optionData.stockPrice;
                    ctx.save();
                    ctx.strokeStyle = 'red';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    ctx.beginPath();
                    ctx.moveTo(x.getPixelForValue(stockPrice), top);
                    ctx.lineTo(x.getPixelForValue(stockPrice), bottom);
                    ctx.stroke();
                    ctx.restore();
                }
            }
        };

        Chart.register(horizonalLine, verticalLine);
    });
</script>

<div class="chart-container">
    <Line data={chartData} options={chartOptions} id="profitCurveChart" />
</div>

<style>
.chart-container {
    height: 400px;
    width: 100%;
}
</style>
