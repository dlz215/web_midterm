let stateDropDownElement = document.querySelector('#state-selector')
let cityInputElement = document.querySelector('#city-input')
let microCheckboxElement = document.querySelector('#type-micro-input')
let regionalCheckboxElement = document.querySelector('#type-regional-input')
let brewpubCheckboxElement = document.querySelector('#type-brewpub-input')
let searchButtonElement = document.querySelector('#search-button')

let state = ''
let city = ''
let type = ''
let page = 1

// Normalize user city input for use in API call.
// Switch to lowercase, remove whitespace, replace spaces with underscore
function normalizeCityString(cityName) {
    city = cityName
    city = cityInputElement.value.toLowerCase()
    city = city.trim()
    for (let i = 0; i < city.length; i++) {
        city = city.replace(' ', '_')
        city = city.replace('.', '')
    }
    city = city.replace('st_', 'saint_')

    return city
}

let breweriesToDisplayOnMap = []
let breweryTypesToSearch = []
let resultsOfCurrentAPICall = []

let mapMarkers = []
let markerText = ''

// One of 3  calls to Open Brewery DB API will be used, depending on user search input
// Variables are defined when user clicks search button
// Max page size defined by Open Brewery DB API is 50
let byCityUrl = `https://api.openbrewerydb.org/breweries?by_state=${state}&by_city=${city}&per_page=50&page=${page}`
let byStateUrl = `https://api.openbrewerydb.org/breweries?by_state=${state}&per_page=50&page=${page}`
let byStateAndTypeUrl = `https://api.openbrewerydb.org/breweries?by_state=${state}&by_type=${type}&per_page=50&page=${page}`

// Coordinates of "center" of US (Northwest Kansas)
let centerUSCoords = [39.67029035031869, -95.9083503557999]
// Appropriate zoom level to display entire US
let zoomLevel = 5

// Create new Leaflet object
let map = L.map('breweries-map').setView(centerUSCoords, zoomLevel)

// Add tiles to Leaflet object
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map)

// Create brewery map icons
var microIcon = L.icon({
    iconUrl: 'micro.png',
    iconAnchor: [0, 0],
    popupAnchor: [0, 0],
});

var regionalIcon = L.icon({
    iconUrl: 'regional.png',
    iconAnchor: [0, 0],
    popupAnchor: [0, 0],
});

var brewpubIcon = L.icon({
    iconUrl: 'brewpub.png',
    iconAnchor: [0, 0],
    popupAnchor: [0, 0],
});

// Event listener for Search button
searchButtonElement.addEventListener('click', () => {

    // Remove any existing markers from the map
    mapMarkers.forEach((marker) => {
        marker.remove()
    })

    // Clear various arrays used to store API call responses, user search input, and map markers
    mapMarkers = []
    breweriesToDisplayOnMap = []
    resultsOfCurrentAPICall = []
    breweryTypesToSearch = []
    page = 1

    /* Check if user has ticked any brewery type checkboxes. If so, add that type to array to be used later in
    defining API call URLs and determining which breweries should be displayed on map. */
    if (microCheckboxElement.checked) {
        breweryTypesToSearch.push('micro')
    }

    if (regionalCheckboxElement.checked) {
        breweryTypesToSearch.push('regional')
    }

    if (brewpubCheckboxElement.checked) {
        breweryTypesToSearch.push('brewpub')
    }


    // Statewide search with no brewery types ticked
    if (cityInputElement.value.length == 0 && breweryTypesToSearch.length == 0) {

        state = stateDropDownElement.value
        byStateUrl = `https://api.openbrewerydb.org/breweries?by_state=${state}&per_page=50&page=${page}`

        getBreweryData(byStateUrl, 'state')

      // Citywide search with no brewery types ticked
    } else if (cityInputElement.value.length != 0 && breweryTypesToSearch.length == 0) {

        state = stateDropDownElement.value
        city = normalizeCityString(cityInputElement.value)
        byCityUrl = `https://api.openbrewerydb.org/breweries?by_state=${state}&by_city=${city}&per_page=50&page=${page}`
        getBreweryData(byCityUrl, 'city')

      // Statewide search with one or more brewery types ticked
    } else if (cityInputElement.value.length == 0 && breweryTypesToSearch.length != 0) {

        /* Because Open Brewery DB API does not allow filtering for more than one brewery type in one call, multiple
        consecutive calls are needed to allow for this type of search. */

        // Call getBreweryData function once for each brewery type ticked by user
        breweryTypesToSearch.forEach((breweryType) => {
            type = breweryType
            state = stateDropDownElement.value
            byStateAndTypeUrl = `https://api.openbrewerydb.org/breweries?by_state=${state}&by_type=${type}&per_page=50&page=${page}`
            getBreweryData(byStateAndTypeUrl , 'stateType')

        })

      // Citywide search with brewery types
    } else if (cityInputElement.value.length != 0 && breweryTypesToSearch.length != 0) {

        /* Because Open Brewery DB API does not allow filtering by state, city, and brewery type in one call, it's
        necessary to make a call filtering only by city and state, then parse through the result set and only display
        breweries of the selected types. */
        state = stateDropDownElement.value
        city = normalizeCityString(cityInputElement.value)
        byCityUrl = `https://api.openbrewerydb.org/breweries?by_state=${state}&by_city=${city}&per_page=50&page=${page}`
        getBreweryData(byCityUrl , 'cityType')

    }

})


// Main function to call Open Brewery DB
function getBreweryData(url, searchScope) {

    fetch(url)
        .then(res => res.json())
        .then(breweryData => {
            // Store results of call in variable
            resultsOfCurrentAPICall = breweryData

            /* Because max page size of API call is 50, multiple recursive calls may be needed to retrieve all breweries
            meeting search criteria. Function will make consecutive calls while incrementing page by 1. Once an empty
            response is received, no further calls will be made. */

            // Check if response to current call is empty. If so function does not execute any further.
            if (resultsOfCurrentAPICall.length > 0) {

                // Add results of current call to array to be used later for adding markers to map
                resultsOfCurrentAPICall.forEach((brewery) => {
                    breweriesToDisplayOnMap.push(brewery)
                })

                /* Call function to add markers to map, increment page number, update URL with new page number,
                and call getBreweryData again */
                if (searchScope == 'state') {
                    addMarkersToMap()
                    page++
                    url = `https://api.openbrewerydb.org/breweries?by_state=${state}&per_page=50&page=${page}`
                    getBreweryData(url, 'state')
                } else if (searchScope == 'city') {
                    addMarkersToMap()
                    page++
                    url = `https://api.openbrewerydb.org/breweries?by_state=${state}&by_city=${city}&per_page=50&page=${page}`
                    getBreweryData(url, 'city')
                } else if (searchScope == 'stateType') {
                    addMarkersToMap()
                    page++
                    url = `https://api.openbrewerydb.org/breweries?by_state=${state}&by_type=${type}&per_page=50&page=${page}`
                    getBreweryData(url, 'stateType')
                } else if (searchScope == 'cityType'){
                    addMarkersToMapCityAndTypeSearch()
                    page++
                    url = `https://api.openbrewerydb.org/breweries?by_state=${state}&by_city=${city}&per_page=50&page=${page}`
                    getBreweryData(url, 'city')
                }
            }
        })
        // Catch any errors from API call, converting to JSON, or adding map markers
        .catch(err => {
            alert("Error retrieving data. Please try again.")
        })

}

// Function to add markers to map for all search types other than a state, city, and brewery type search
function addMarkersToMap() {

    breweriesToDisplayOnMap.forEach((brewery) => {

        /* Check each brewery in result set. Filter out breweries without latitude and longitude data and breweries of
        types that will not be relevant to the user. */
        if ( brewery.latitude != null && brewery.longitude != null &&
            (brewery.brewery_type == 'micro' || brewery.brewery_type == 'regional' || brewery.brewery_type == 'brewpub') ) {

            // If brewery data includes a website URL, display link in map marker pop up
            if (brewery.website_url != null) {
                markerText = `${brewery.name}<br>${brewery.city}, ${brewery.state}<br><a id="hyperlink" href="${brewery.website_url}">Website</a>`
            } else {
                markerText = `${brewery.name}<br>${brewery.city}, ${brewery.state}`
            }

            // Store brewery coordinates in variable
            let coordinates = []
            coordinates.push(brewery.latitude)
            coordinates.push(brewery.longitude)

            // Apply appropriate marker icon by brewery type and add marker to map
            if (brewery.brewery_type == 'micro') {
                let marker = L.marker(coordinates, {icon: microIcon}).bindPopup(markerText).addTo(map)
                mapMarkers.push(marker)
            } else if (brewery.brewery_type == 'regional') {
                let marker = L.marker(coordinates, {icon: regionalIcon}).bindPopup(markerText).addTo(map)
                mapMarkers.push(marker)
            } else if (brewery.brewery_type == 'brewpub') {
                let marker = L.marker(coordinates, {icon: brewpubIcon}).bindPopup(markerText).addTo(map)
                mapMarkers.push(marker)
            }

        }
    })

    }

// Function to add markers to map for a state, city, and brewery type search
function addMarkersToMapCityAndTypeSearch() {

    // Loop through result set for each brewery type selected by user
    breweryTypesToSearch.forEach((breweryType) => {


        breweriesToDisplayOnMap.forEach((brewery) => {

            // Display only breweries with matching type
            if (brewery.latitude != null && brewery.longitude != null && brewery.brewery_type == breweryType) {

                if (brewery.website_url != null) {
                    markerText = `${brewery.name}<br>${brewery.city}, ${brewery.state}<br><a id="hyperlink" href="${brewery.website_url}">Website</a>`
                } else {
                    markerText = `${brewery.name}<br>${brewery.city}, ${brewery.state}`
                }

                let coordinates = []
                coordinates.push(brewery.latitude)
                coordinates.push(brewery.longitude)

                if (brewery.brewery_type == 'micro') {
                    let marker = L.marker(coordinates, {icon: microIcon}).bindPopup(markerText).addTo(map)
                    mapMarkers.push(marker)
                } else if (brewery.brewery_type == 'regional') {
                    let marker = L.marker(coordinates, {icon: regionalIcon}).bindPopup(markerText).addTo(map)
                    mapMarkers.push(marker)
                } else if (brewery.brewery_type == 'brewpub') {
                    let marker = L.marker(coordinates, {icon: brewpubIcon}).bindPopup(markerText).addTo(map)
                    mapMarkers.push(marker)
                }
            }
        })
    })

}













