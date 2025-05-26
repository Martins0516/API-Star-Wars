const http = require('http');
const https = require('https');

const SWAPI_BASE_URL = 'https://swapi.dev/api/';
const DEFAULT_TIMEOUT = 5000;
const LARGE_POPULATION = 1_000_000_000;
const LARGE_DIAMETER = 10_000;
const STARSHIPS_LIMIT = 3;
const MAX_VEHICLE_ID = 4;

let debugMode = true;
let timeout = DEFAULT_TIMEOUT;

let cache = {};
let errorCount = 0;
let fetchCount = 0;
let totalDataSize = 0;
let lastCharacterId = 1;

async function fetchResource(endpoint) {
    if (cache[endpoint]) {
        if (debugMode) console.log("Using cached data for", endpoint);
        return cache[endpoint];
    }

    return new Promise((resolve, reject) => {
        let responseData = '';

        const request = https.get(`${SWAPI_BASE_URL}${endpoint}`, { rejectUnauthorized: false }, (res) => {
            if (res.statusCode >= 400) {
                errorCount++;
                return reject(new Error(`Request failed with status code ${res.statusCode}`));
            }

            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(responseData);
                    cache[endpoint] = json;
                    resolve(json);

                    if (debugMode) {
                        console.log(`Successfully fetched data for ${endpoint}`);
                        console.log(`Cache size: ${Object.keys(cache).length}`);
                    }
                } catch (error) {
                    errorCount++;
                    reject(error);
                }
            });
        });

        request.on('error', error => {
            errorCount++;
            reject(error);
        });

        request.setTimeout(timeout, () => {
            request.abort();
            errorCount++;
            reject(new Error(`Request timeout for ${endpoint}`));
        });
    });
}

async function displayCharacterData() {
    const character = await fetchResource(`people/${lastCharacterId}`);
    totalDataSize += JSON.stringify(character).length;

    console.log('Character:', character.name);
    console.log('Height:', character.height);
    console.log('Mass:', character.mass);
    console.log('Birthday:', character.birth_year);
    if (character.films?.length > 0) {
        console.log('Appears in', character.films.length, 'films');
    }
}

async function displayStarships() {
    const starships = await fetchResource('starships/?page=1');
    totalDataSize += JSON.stringify(starships).length;

    console.log('\nTotal Starships:', starships.count);

    for (let i = 0; i < Math.min(STARSHIPS_LIMIT, starships.results.length); i++) {
        const ship = starships.results[i];
        console.log(`\nStarship ${i + 1}:`);
        console.log('Name:', ship.name);
        console.log('Model:', ship.model);
        console.log('Manufacturer:', ship.manufacturer);
        console.log('Cost:', ship.cost_in_credits !== 'unknown' ? ship.cost_in_credits + ' credits' : 'unknown');
        console.log('Speed:', ship.max_atmosphering_speed);
        console.log('Hyperdrive Rating:', ship.hyperdrive_rating);
        if (ship.pilots?.length > 0) {
            console.log('Pilots:', ship.pilots.length);
        }
    }
}

async function displayLargePlanets() {
    const planets = await fetchResource('planets/?page=1');
    totalDataSize += JSON.stringify(planets).length;

    console.log('\nLarge populated planets:');
    planets.results.forEach(planet => {
        const population = parseInt(planet.population);
        const diameter = parseInt(planet.diameter);
        if (!isNaN(population) && population > LARGE_POPULATION &&
            !isNaN(diameter) && diameter > LARGE_DIAMETER) {
            console.log(`${planet.name} - Pop: ${planet.population} - Diameter: ${planet.diameter} - Climate: ${planet.climate}`);
            if (planet.films?.length > 0) {
                console.log(`  Appears in ${planet.films.length} films`);
            }
        }
    });
}

async function displayFilms() {
    const films = await fetchResource('films/');
    totalDataSize += JSON.stringify(films).length;

    const sortedFilms = films.results.sort((a, b) => new Date(a.release_date) - new Date(b.release_date));
    console.log('\nStar Wars Films in chronological order:');
    sortedFilms.forEach((film, i) => {
        console.log(`${i + 1}. ${film.title} (${film.release_date})`);
        console.log(`   Director: ${film.director}`);
        console.log(`   Producer: ${film.producer}`);
        console.log(`   Characters: ${film.characters.length}`);
        console.log(`   Planets: ${film.planets.length}`);
    });
}

async function displayVehicle() {
    if (lastCharacterId <= MAX_VEHICLE_ID) {
        const vehicle = await fetchResource(`vehicles/${lastCharacterId}`);
        totalDataSize += JSON.stringify(vehicle).length;

        console.log('\nFeatured Vehicle:');
        console.log('Name:', vehicle.name);
        console.log('Model:', vehicle.model);
        console.log('Manufacturer:', vehicle.manufacturer);
        console.log('Cost:', vehicle.cost_in_credits, 'credits');
        console.log('Length:', vehicle.length);
        console.log('Crew Required:', vehicle.crew);
        console.log('Passengers:', vehicle.passengers);
        lastCharacterId++;
    }
}

function displayStats() {
    if (debugMode) {
        console.log('\nStats:');
        console.log('API Calls:', fetchCount);
        console.log('Cache Size:', Object.keys(cache).length);
        console.log('Total Data Size:', totalDataSize, 'bytes');
        console.log('Error Count:', errorCount);
    }
}

async function runDemo() {
    try {
        if (debugMode) console.log("Starting data fetch...");
        fetchCount++;

        await displayCharacterData();
        await displayStarships();
        await displayLargePlanets();
        await displayFilms();
        await displayVehicle();
        displayStats();
    } catch (e) {
        console.error('Error:', e.message);
        errorCount++;
    }
}

const args = process.argv.slice(2);
if (args.includes('--no-debug')) debugMode = false;
if (args.includes('--timeout')) {
    const index = args.indexOf('--timeout');
    if (index < args.length - 1) {
        const t = parseInt(args[index + 1]);
        if (!isNaN(t)) timeout = t;
    }
}

const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Star Wars API Demo</title>
                    <style>
                        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                        h1 { color: #FFE81F; background-color: #000; padding: 10px; }
                        button { background-color: #FFE81F; border: none; padding: 10px 20px; cursor: pointer; }
                        .footer { margin-top: 50px; font-size: 12px; color: #666; }
                        pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
                    </style>
                </head>
                <body>
                    <h1>Star Wars API Demo</h1>
                    <p>This page demonstrates fetching data from the Star Wars API.</p>
                    <p>Check your console for the API results.</p>
                    <button onclick="fetchData()">Fetch Star Wars Data</button>
                    <div id="results"></div>
                    <script>
                        function fetchData() {
                            document.getElementById('results').innerHTML = '<p>Loading data...</p>';
                            fetch('/api')
                                .then(res => res.text())
                                .then(text => {
                                    alert('API request made! Check server console.');
                                    document.getElementById('results').innerHTML = '<p>Data fetched! Check server console.</p>';
                                })
                                .catch(err => {
                                    document.getElementById('results').innerHTML = '<p>Error: ' + err.message + '</p>';
                                });
                        }
                    </script>
                    <div class="footer">
                        <p>API calls: ${fetchCount} | Cache entries: ${Object.keys(cache).length} | Errors: ${errorCount}</p>
                        <pre>Debug mode: ${debugMode ? 'ON' : 'OFF'} | Timeout: ${timeout}ms</pre>
                    </div>
                </body>
            </html>
        `);
    } else if (req.url === '/api') {
        runDemo();
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end('Check server console for results');
    } else if (req.url === '/stats') {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
            api_calls: fetchCount,
            cache_size: Object.keys(cache).length,
            data_size: totalDataSize,
            errors: errorCount,
            debug: debugMode,
            timeout: timeout
        }));
    } else {
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end('Not Found');
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log('Open the URL in your browser and click the button to fetch Star Wars data');
    if (debugMode) {
        console.log('Debug mode: ON');
        console.log('Timeout:', timeout, 'ms');
    }
});
