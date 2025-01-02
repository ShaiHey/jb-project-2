"use strict";

(async () => {
    const displaySearchAndToggle = (display, block) => {
        document.getElementById("inputSearch").style.display = display;
        document.getElementById("allSelectedCoins").style.display = block ? block : display;
    }

    const getData = async url => fetch(url).then(response => response.json());

    const getAllCoins = async () => {
        const cachedData = localStorage.getItem("allCoins");
        const cacheTime = localStorage.getItem("allCoinsTime");
        const now = new Date().getTime();
    
        if (cachedData && cacheTime && now - cacheTime < 3 * 60 * 1000) {
            return JSON.parse(cachedData);
        }

        const data = await getData("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1");
    
        localStorage.setItem("allCoins", JSON.stringify(data));
        localStorage.setItem("allCoinsTime", now);
    
        return data;
    }

    const getSinglesCoinInfo = () => JSON.parse(localStorage.getItem("singlesCoinsInfo")) || {};

    const setSinglesCoinInfo = newArr => localStorage.setItem("singlesCoinsInfo", JSON.stringify(newArr));

    const getSingleCoin = async coin => {
        const coins = getSinglesCoinInfo();
        const cachedCoin = coins[coin];
        const now = new Date();
    
        if (cachedCoin && (now - new Date(cachedCoin.time)) <= 2 * 60 * 1000) {
            return cachedCoin;
        }
    
        const newData = await getData(`https://api.coingecko.com/api/v3/coins/${coin}`);
        newData.time = now;
        coins[coin] = newData;
        setSinglesCoinInfo(coins);
        
        return newData;
    }

    const getGraphData = async coins => getData(`https://min-api.cryptocompare.com/data/pricemulti?fsyms=${coins.join(',')}&tsyms=USD`);

    const getEnabledCoins = () => JSON.parse(localStorage.getItem("reportsCoins")) || [];

    const setEnabledCoins = coins => localStorage.setItem("reportsCoins", JSON.stringify(coins));

    const generateCoinsHTML = coins => coins
        .map(({ symbol, name, id }) => {
            const allEnabledToggles = getEnabledCoins();
            const isEnable = allEnabledToggles.includes(symbol);

            return `
                <div class="card">
                <div class="card-body">
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" role="switch" id="${symbol}" ${isEnable ? "checked" : ""}>
                    </div>
                <h5 class="card-title">${symbol.toUpperCase()}</h5>
                <p class="card-text">${name}</p>
                <a tabindex="0" class="btn btn-primary" id="${id}" role="button" data-bs-toggle="popover" data-bs-title="More info" data-bs-content="And here's some amazing content. It's very engaging. Right?">More Info</a>
                <div id="progressBarContainer-${id}" style="display: none;">
                <div class="progress">
                    <div id="progressBar-${id}" class="progress-bar" role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>
                </div>
                </div>
                </div>
                </div>
            `
        })
        .join("");


    let updateInterval = null;
    let chart = null;
    const generateGraph = async (coins) => {
        const ctx = document.getElementById('liveChart').getContext('2d');
        const data = {
            labels: [],
            datasets: coins.map((coin) => ({
                label: coin.toUpperCase(),
                backgroundColor: getRandomColor(),
                data: [],
                fill: false,
            }))
        };


        chart = new Chart(ctx, {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        },
                    },
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Price (USD)'
                        }
                    }
                },
            }
        });

        const updateGraph = async () => {
            const currentTime = new Date().toLocaleTimeString();
            const graphData = await getGraphData(coins);

            if (!graphData || Object.keys(graphData).length === 0) {
                console.warn("No data received for cryptos");
                return;
            }

            coins.forEach((coin, index) => {
                const cap = coin.toUpperCase();
                if (graphData[cap] && graphData[cap].USD !== undefined) {
                    const price = graphData[cap].USD;
                    data.labels.push(currentTime);
                    data.datasets[index].data.push({ x: currentTime, y: price });
                } else {
                    console.warn(`The price for ${cap} could not be retrieved.`);
                    data.labels.push(currentTime);
                    data.datasets[index].data.push({ x: currentTime, y: 0 });
                }

                if (data.labels.length > 20) {
                    data.labels.shift();
                    data.datasets[index].data.shift();
                }
            });

            chart.update();
        };

        updateGraph();

        updateInterval = setInterval(updateGraph, 2000);
    };

    const getRandomColor = () => {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    };

    const resetGraph = () => {
        if (chart) {
            chart.destroy();
            chart = null;
        }

        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }
    };

    const renderCoinsHTML = newHTML => document.getElementById("cardsContainer").innerHTML = newHTML ? newHTML : `
        <div class="alert alert-warning alert-dismissible fade show" role="alert">
            <strong>Warning!</strong> No results found
        </div>
    `;

    const addEventButton = () => {
        const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');

        popoverTriggerList.forEach(popoverTriggerEl => {
            const popover = new bootstrap.Popover(popoverTriggerEl, {
                trigger: "manual",
                html: true
            });

            popoverTriggerEl.addEventListener('focusout', () => {
                popover.hide();
            });

            popoverTriggerEl.addEventListener("click", async function () {
                const progressBarContainer = document.getElementById(`progressBarContainer-${this.id}`);
                const progressBar = document.getElementById(`progressBar-${this.id}`);

                progressBarContainer.style.display = 'block';
                progressBar.style.width = '0%';
                progressBar.textContent = '0%';

                const coin = await getSingleCoin(this.id);

                let progress = 0;
                const interval = setInterval(() => {
                    if (progress < 100) {
                        progress += 5;
                        progressBar.style.width = `${progress}%`;
                        progressBar.textContent = `${progress}%`;
                    } else {
                        clearInterval(interval);

                        popover.setContent({
                            '.popover-header': `<img src="${coin.image.thumb}" alt=""> ${coin.name}`,
                            '.popover-body': `
                                <h1>Pricing:</h1>
                                USD : ${coin.market_data.current_price.usd}$
                                <br>
                                EUR : ${coin.market_data.current_price.eur}€
                                <br>
                                ILS : ${coin.market_data.current_price.ils}₪
                            `
                        });

                        popover.show();

                        progressBarContainer.style.display = 'none';
                    }
                }, 50);
            });
        });
    };


    const addEventToggle = () => {
        const allToggle = document.querySelectorAll('.card-body > .form-check > .form-check-input');
        allToggle.forEach(toggle => toggle.addEventListener("click", function () {
            enableToggle(toggle)
        }))
    }

    const addEventToggleModal = addToggle => {
        const allToggle = document.querySelectorAll('#modalBody > .form-check > .form-check-input');
        allToggle.forEach(toggle => toggle.addEventListener("click", function () {
            enableToggle(toggle, addToggle)
        }))
    }

    const generateSwitchForModal = () => {
        const allEnabledToggles = getEnabledCoins();
        return allEnabledToggles.map(coin => `
            <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" role="switch" id="${coin}" checked>
                <label class="form-check-label" for="${coin}">${coin.toUpperCase()}</label>
            </div>
        `).join("")
    }

    const getAndDisplayCoins = async (coins) => {
        // Generate HTML
        const newHTML = generateCoinsHTML(coins);

        // Render HTML
        renderCoinsHTML(newHTML);

        // Add Button event
        addEventButton();

        // Add Event toggle
        addEventToggle();
    }

    const enableToggle = (toggle, addToggle) => {
        const allEnabledToggles = getEnabledCoins();
        const isEnable = allEnabledToggles.find(coin => coin === toggle.id);

        if (isEnable) {
            const indexOfCoin = allEnabledToggles.findIndex(coin => coin === toggle.id);
            allEnabledToggles.splice(indexOfCoin, 1);
            toggle.checked = false;
            if (addToggle) {
                const isEnable = allEnabledToggles.find(coin => coin === addToggle);
                if (!isEnable) allEnabledToggles.push(addToggle);
            }
        } else {
            if (allEnabledToggles.length === 5) {
                const errorMessage = new bootstrap.Modal(document.getElementById('errorMessageCoins'))
                document.getElementById("errorMessageText").innerHTML = `You can't add more than 5 cryptos to reports you already have : ${allEnabledToggles.join(", ")} you can deselect one to put it if you deactivate several they will be deactivated`;
                document.getElementById("modalBody").innerHTML += generateSwitchForModal(toggle);
                addEventToggleModal(toggle.id);
                errorMessage.show();
                toggle.checked = false;
                return
            }
            allEnabledToggles.push(toggle.id);
            toggle.checked = true;
        }

        setEnabledCoins(allEnabledToggles);
    }

    const myModalEl = document.getElementById('errorMessageCoins');

    myModalEl.addEventListener('hidden.bs.modal', async function () {
        document.getElementById("modalBody").innerHTML = '<p id="errorMessageText"></p>';
        try {
            // Get data
            const coins = await getAllCoins();

            getAndDisplayCoins(coins);
        } catch (error) {
            console.warn(error);
        }
    });

    const showAllSelectedCoins = () => {
        const filterCheckbox = document.getElementById("showSelectedCoins");
        const cards = document.querySelectorAll(".card");
        const selectedCryptos = getEnabledCoins();

        const toggleCardVisibility = (card, isSelected) => {
            card.style.display = isSelected ? "block" : "none";
        };

        if (filterCheckbox.checked) {
            cards.forEach((card) => {
                const coinId = card.querySelector(".card-body > .form-check > input[type='checkbox']").id;
                const isSelected = selectedCryptos.includes(coinId);
                toggleCardVisibility(card, isSelected);
            });
        } else {
            cards.forEach((card) => {
                toggleCardVisibility(card, true);
            });
        }
    }

    const handleTabChange = (display, block) => {
        resetGraph();
        displaySearchAndToggle(display, block);
    };

    document.getElementById("pills-coins-tab").addEventListener("click", async () => {
        handleTabChange("flex", "block");
        try {
            // Get data
            const coins = await getAllCoins();

            getAndDisplayCoins(coins);
        } catch (error) {
            console.warn(error);
        }
    })

    document.getElementById("button-search").addEventListener("click", async () => {
        try {
            // Get search
            const searchValue = document.getElementById("searchInput").value;

            // Get data
            const coins = await getAllCoins();
            const filterSearch = coins.filter(({ symbol }) => symbol.toLowerCase() === searchValue.toLowerCase())

            getAndDisplayCoins(filterSearch);
        } catch (error) {
            console.warn(error);
        }
    })

    document.getElementById("pills-reports-tab").addEventListener("click", async () => {
        handleTabChange("none");
        try {
            const coinsInReports = getEnabledCoins();

            if (coinsInReports.length === 0) {
                document.getElementById("errorMessageReports").style.display = "block"
                return;
            }

            document.getElementById("errorMessageReports").style.display = "none"

            generateGraph(coinsInReports);
        } catch (error) {
            console.warn(error);
        }
    });

    document.getElementById("pills-about-tab").addEventListener("click", () => {
        handleTabChange("none");
    })

    document.getElementById("showSelectedCoins").addEventListener("change", async () => {
        try {
            // Get data
            const coins = await getAllCoins();

            getAndDisplayCoins(coins);

            showAllSelectedCoins();
        } catch (error) {
            console.warn(error);
        }
    })

    const loadCoinsPage = async () => {
        try {
            // Get data
            const coins = await getAllCoins();

            getAndDisplayCoins(coins);
        } catch (error) {
            console.warn(error);
        }
    }

    const initStorage = () => {
        const singlesCoinsInfo = localStorage.getItem("singlesCoinsInfo");
        const reportsCoins = localStorage.getItem("reportsCoins");
        const allCoins = localStorage.getItem("allCoins");
        const allCoinsTime = localStorage.getItem("allCoinsTime");

        if (!singlesCoinsInfo) setSinglesCoinInfo({});
        if (!reportsCoins) setEnabledCoins([]);

        if (!allCoins) localStorage.setItem("allCoins", JSON.stringify([]));
        if (!allCoinsTime) localStorage.setItem("allCoinsTime", "");
    }

    loadCoinsPage();
    initStorage();
})()