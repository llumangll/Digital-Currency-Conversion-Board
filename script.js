// Initialize Lucide icons
lucide.createIcons();

// --- Configuration ---
const EXCHANGE_API_KEY = "75adaa949a79248fe9c6d4f9"; // *** REPLACE WITH YOUR KEY ***
const GNEWS_API_KEY = "14f6e76e9196cefd9403fe70130637ed"; // *** REPLACE WITH YOUR KEY ***
const EXCHANGE_URL_BASE = `https://v6.exchangerate-api.com/v6/${EXCHANGE_API_KEY}/latest/USD`;
const MARKET_AUX_URL = `https://api.allorigins.win/raw?url=${encodeURIComponent(
    "https://api.marketaux.com/v1/news/all?filter[category]=forex&language=en&limit=5&api_token=lgSUYGFZ1PGz3AZCxW58vyHeuC1jQ02wT7sqFfGE"
)}`;
const RETRY_LIMIT = 5;
const KEY_RATES = ["EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", "INR"];

// --- State ---
let conversionRates = {};
let currencyCodes = [];
let historicalChart = null; // To hold the chart instance

// --- DOM Elements ---
const $fromAmount = document.getElementById('amount-from');
const $fromCurrency = document.getElementById('currency-from');
const $toCurrency = document.getElementById('currency-to');
const $swapButton = document.getElementById('swap-button');
const $result = document.getElementById('conversion-result');
const $rateDisplay = document.getElementById('rate-display');
const $liveRatesBoard = document.getElementById('live-rates-board');
const $newsFeed = document.getElementById('news-feed');
const $loadingOverlay = document.getElementById('loading-overlay');
const $errorMsg = document.getElementById('api-error-message');
const $errorText = document.getElementById('error-text');

// --- Utility Functions ---

function toggleLoading(show) {
    $loadingOverlay.style.opacity = show ? '1' : '0';
    $loadingOverlay.style.pointerEvents = show ? 'auto' : 'none';
}

function displayError(message) {
    $errorText.textContent = message;
    $errorMsg.classList.remove('hidden');
}

async function fetchWithRetry(url, options = {}, retries = RETRY_LIMIT) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                if (response.status === 404 || response.status === 403) {
                    throw new Error(`API returned status ${response.status}. Check if your API key is valid.`);
                }
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        } catch (error) {
            if (i === retries - 1) {
                console.error('Fetch failed after multiple retries:', url, error);
                throw error;
            }
            const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

function populateCurrencies() {
    if (currencyCodes.length === 0) {
        currencyCodes = Object.keys(conversionRates).length > 0
            ? Object.keys(conversionRates).sort()
            : ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", "INR", "ZAR", "BRL"];
    }

    const fragment = document.createDocumentFragment();
    currencyCodes.forEach(code => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = code;
        fragment.appendChild(option);
    });

    $fromCurrency.innerHTML = '';
    $toCurrency.innerHTML = '';
    $fromCurrency.appendChild(fragment.cloneNode(true));
    $toCurrency.appendChild(fragment.cloneNode(true));

    $fromCurrency.value = 'USD';
    $toCurrency.value = 'EUR';

    convertCurrency();
}

// --- Main Logic Functions ---

async function fetchRates() {
    if (EXCHANGE_API_KEY.includes("YOUR_") || EXCHANGE_API_KEY.includes("http")) {
        displayError("Please replace 'YOUR_EXCHANGE_RATE_API_KEY' with your actual key to fetch live rates.");
        return;
    }

    try {
        const data = await fetchWithRetry(EXCHANGE_URL_BASE);
        if (data.result === 'success') {
            conversionRates = data.conversion_rates;
            currencyCodes = Object.keys(conversionRates).sort();
            populateCurrencies();
            renderLiveRates();
        } else {
            displayError(`Exchange Rate API failed: ${data['error-type'] || 'Unknown error'}`);
        }
    } catch (error) {
        displayError(`Failed to connect to the Exchange Rate API. (${error.message})`);
        console.error("Exchange Rate API fetch error:", error);
    }
}

function convertCurrency() {
    const amount = parseFloat($fromAmount.value);
    const fromCode = $fromCurrency.value;
    const toCode = $toCurrency.value;

    if (isNaN(amount) || amount <= 0 || !conversionRates[fromCode] || !conversionRates[toCode]) {
        $result.textContent = "Enter a valid amount.";
        $rateDisplay.textContent = "";
        return;
    }

    const rate = conversionRates[toCode] / conversionRates[fromCode];
    const resultAmount = amount * rate;

    $result.textContent = `${amount.toFixed(2)} ${fromCode} = ${resultAmount.toFixed(4)} ${toCode}`;
    $rateDisplay.textContent = `1 ${fromCode} = ${rate.toFixed(6)} ${toCode}`;
}

function renderHistoricalChart(baseCurrency, targetCurrency) {
    document.getElementById("historic-heading").textContent =
        `Historical Trend (${baseCurrency}/${targetCurrency} - Last 7 Days)`;

    const ctx = document.getElementById('historical-chart').getContext('2d');
    const currentRate = conversionRates[targetCurrency] / conversionRates[baseCurrency] || 1;
    const dates = ['Day -6', 'Day -5', 'Day -4', 'Day -3', 'Day -2', 'Yesterday', 'Today'];
    const mockRates = Array.from({ length: 7 }, (_, i) =>
        currentRate * (1 + (Math.random() - 0.5) * 0.02)
    );

    if (historicalChart) {
        // If the chart exists, just update its data
        historicalChart.data.labels = dates;
        historicalChart.data.datasets[0].data = mockRates;
        historicalChart.data.datasets[0].label = `${baseCurrency}/${targetCurrency} Exchange Rate`;
        historicalChart.options.plugins.title.text = `Historical Trend (${baseCurrency}/${targetCurrency} - Last 7 Days)`;
        historicalChart.update(); // This animates the change
    }
    else {
        historicalChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: `${baseCurrency}/${targetCurrency} Exchange Rate`,
                    data: mockRates,
                    borderColor: '#22d3ee',
                    backgroundColor: 'rgba(34, 211, 238, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#06b6d4',
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#9ca3af' } },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    x: {
                        grid: { color: '#374151' },
                        ticks: { color: '#9ca3af' }
                    },
                    y: {
                        beginAtZero: false,
                        grid: { color: '#374151' },
                        ticks: {
                            color: '#9ca3af',
                            callback: value => value.toFixed(4)
                        }
                    }
                }
            }
        });
    }
}

function renderLiveRates() {
    $liveRatesBoard.innerHTML = '';
    KEY_RATES.forEach(code => {
        const rateToBase = conversionRates[code];
        const rateFromBase = 1 / rateToBase;

        if (conversionRates[code] && code !== "USD") {
            const rateDisplay = rateFromBase.toFixed(4);
            const div = document.createElement('div');
            div.className = 'p-4 bg-gray-700/80 rounded-xl shadow-lg border border-teal-800 hover:bg-gray-700 transition duration-150 transform hover:scale-[1.02]';
            div.innerHTML = `
                <p class="text-xl font-extrabold text-cyan-400">${code}</p>
                <p class="text-xs text-gray-400 mt-1">1 USD = </p>
                <p class="text-lg font-bold text-green-400">${rateDisplay}</p>
            `;
            $liveRatesBoard.appendChild(div);
        }
    });
    lucide.createIcons();
}

async function fetchNews() {
    try {
        const data = await fetchWithRetry(MARKET_AUX_URL);
        const articles = data.data || [];
        if (articles.length > 0) {
            const formatted = articles.map(item => ({
                title: item.title,
                description: item.description || item.snippet || "No description available.",
                url: item.url,
                source: { name: item.source || "MarketAux" }
            }));
            renderNews(formatted);
        } else {
            renderNews([]);
            console.warn("MarketAux API returned no articles or unexpected structure:", data);
        }
    } catch (error) {
        const errorItem = {
            title: "News Service Unavailable",
            description: `Failed to fetch news. Check API key or network connection.`,
            source: { name: "System" },
            url: "#"
        };
        renderNews([errorItem]);
        console.error("MarketAux API fetch error:", error);
    }
}

function renderNews(articles) {
    $newsFeed.innerHTML = '';
    if (articles.length === 0) {
        $newsFeed.innerHTML = '<p class="text-gray-500 p-4 text-center">No recent forex news available.</p>';
        return;
    }

    articles.forEach(article => {
        const articleDiv = document.createElement('a');
        articleDiv.href = article.url || '#';
        articleDiv.target = "_blank";
        articleDiv.className = 'block p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition duration-200 border-l-4 border-teal-500 shadow-md';
        articleDiv.innerHTML = `
            <p class="text-md font-semibold text-white">${article.title || 'No Title'}</p>
            <p class="text-sm text-gray-400 mt-1 line-clamp-2">${article.description || 'No description available.'}</p>
            <p class="text-xs text-cyan-500 mt-2 font-mono">${article.source?.name || 'Unknown Source'}</p>
        `;
        $newsFeed.appendChild(articleDiv);
    });
}

function swapCurrencies() {
    const fromValue = $fromCurrency.value;
    const toValue = $toCurrency.value;
    $fromCurrency.value = toValue;
    $toCurrency.value = fromValue;
}

// --- Event Listeners and Initialization ---

window.onload = async function () {
    toggleLoading(true);
    await fetchRates();
    // Render the initial chart after rates are available
    renderHistoricalChart('USD', 'EUR');
    await fetchNews();
    toggleLoading(false);
};

// --- Updated Event Listeners ---

// This listener ONLY calculates the new amount.
$fromAmount.addEventListener('input', convertCurrency);

// These listeners calculate AND redraw the chart.
$fromCurrency.addEventListener('change', () => {
    convertCurrency();
    renderHistoricalChart($fromCurrency.value, $toCurrency.value);
});

$toCurrency.addEventListener('change', () => {
    convertCurrency();
    renderHistoricalChart($fromCurrency.value, $toCurrency.value);
});

// This is the corrected event listener for the swap button
$swapButton.addEventListener('click', () => {
    swapCurrencies();
    convertCurrency();
    renderHistoricalChart($fromCurrency.value, $toCurrency.value);
});