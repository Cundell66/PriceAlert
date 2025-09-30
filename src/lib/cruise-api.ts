// src/lib/cruise-api.ts

export interface Fare {
    deal_code: string; // e.g., 'BR1', 'FLA', 'AUREA'
    grade_code: string;
    grade_name: string;
    price: string;
    // ... other fare properties
}

export interface FareSet {
    name: string;
    fares: Fare[];
    // ... other fare set properties
}

// Represents a cruise from the API, containing multiple grades
export interface CruiseFromApi {
    vendor_id: string;
    name:string;
    ship_title: string;
    starts_on: string;
    fare_sets: FareSet[];
    // ... other cruise properties
}

// Represents a flattened, unique cruise offering (1 cruise + 1 cabin grade + 1 deal)
// This is the structure we'll use for comparisons.
export interface CruiseOffering {
    offering_id: string; // A stable, unique ID for this specific offering
    vendor_id: string;
    ship_title: string;
    starts_on: string;
    deal_code: string;
    grade_code: string;
    grade_name: string;
    price: string;
}


interface ApiResponse {
    cruises?: CruiseFromApi[];
    _links: {
        next?: {
            href: string;
        };
    };
}

const API_ENDPOINT_URL = process.env.API_ENDPOINT_URL || "https://www.widgety.co.uk/api/cruises.json?app_id=4ad715a61acc68d4505319eb4270705fc20d2790&operator=msc-cruises&start_from=Southampton&token=df770a1821b3878341f3870173e3c2d2733a10d4a7d8c34fd05f0e83f6dc7dfa";

const headers = {
    "Accept": "application/json;api_version=2",
    "User-Agent": "CruiseAboardTracker/1.2"
};

/**
 * Fetches all cruises from the paginated API and flattens the response
 * into a list of unique cruise offerings (cruise + cabin grade + deal).
 * @returns A promise that resolves to an array of all cruise offerings.
 */
export async function fetchCruises(): Promise<CruiseOffering[]> {
    const offeringsMap = new Map<string, CruiseOffering>();
    let currentUrl: string | undefined = API_ENDPOINT_URL;

    while (currentUrl) {
        try {
            console.log(`Fetching data from: ${currentUrl}`);
            const response = await fetch(currentUrl, { headers });

            if (!response.ok) {
                console.error(`API request to ${currentUrl} failed with status ${response.status}`);
                const errorBody = await response.text();
                console.error('API Error Body:', errorBody);
                break;
            }
            
            // Clone the response to log the raw text, as the body can only be read once
            const responseClone = response.clone();
            const rawText = await responseClone.text();
            console.log(`DEBUG: Raw API response text from ${currentUrl}: ${rawText.substring(0, 500)}...`);

            const data: ApiResponse = await response.json();
            const cruises = data.cruises || [];
            console.log(`DEBUG: Parsed JSON data:`, data);
            console.log(`DEBUG: Found ${cruises.length} cruises on this page.`);

            // Flatten the hierarchical structure
            for (const cruise of cruises) {
                if (cruise.fare_sets && Array.isArray(cruise.fare_sets)) {
                    for (const fareSet of cruise.fare_sets) {
                        if (fareSet.fares && Array.isArray(fareSet.fares)) {
                             for (const fare of fareSet.fares) {
                                const price = parseFloat(fare.price);
                                // A fare must have a grade, a deal, and a positive price to be considered valid
                                if (fare.deal_code && fare.grade_code && price > 0) {
                                    // Create a stable, unique ID for this specific offering
                                    const offering_id = `${cruise.vendor_id}|${fare.deal_code}|${fare.grade_code}`;
                                    
                                    offeringsMap.set(offering_id, {
                                        offering_id,
                                        vendor_id: cruise.vendor_id,
                                        ship_title: cruise.ship_title,
                                        starts_on: cruise.starts_on,
                                        deal_code: fare.deal_code,
                                        grade_code: fare.grade_code,
                                        grade_name: fare.grade_name,
                                        price: fare.price,
                                    });
                                }
                            }
                        }
                    }
                }
            }
            
            const nextUrl = data._links?.next?.href;

            if (nextUrl && nextUrl !== currentUrl) {
                currentUrl = nextUrl;
            } else {
                currentUrl = undefined; // End loop if no next link or it's same as current
            }

        } catch (error) {
            console.error("Error fetching or parsing cruises:", error);
            currentUrl = undefined; // Stop pagination on error
        }
    }

    const allOfferings = Array.from(offeringsMap.values());
    console.log(`Total unique cruise offerings fetched: ${allOfferings.length}`);
    return allOfferings;
}