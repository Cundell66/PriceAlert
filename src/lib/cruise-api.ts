
// src/lib/cruise-api.ts

// Represents a cruise from the API, containing multiple grades
export interface CruiseFromApi {
    vendor_id: string;
    name: string;
    ship_title: string;
    starts_on: string;
    // The prices are properties on the cruise object itself
    inside_price?: string;
    outside_price?: string;
    balcony_price?: string;
    suite_price?: string;
    // ... other cruise properties
}

// Represents a flattened, unique cruise offering (1 cruise + 1 cabin grade)
// This is the structure we'll use for comparisons.
export interface CruiseOffering {
    vendor_id: string;
    name: string;
    ship_title: string;
    starts_on: string;
    grade_name: string; // "Inside", "Outside", "Balcony", "Suite"
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

const cabinPriceFields: { key: keyof CruiseFromApi, name: string }[] = [
    { key: 'inside_price', name: 'Inside' },
    { key: 'outside_price', name: 'Outside' },
    { key: 'balcony_price', name: 'Balcony' },
    { key: 'suite_price', name: 'Suite' },
];


/**
 * Fetches all cruises from the paginated API and flattens the response
 * into a list of unique cruise offerings (cruise + cabin grade).
 * @returns A promise that resolves to an array of all cruise offerings.
 */
export async function fetchCruises(): Promise<CruiseOffering[]> {
    let allOfferings: CruiseOffering[] = [];
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
            
            const data: ApiResponse = await response.json();

            const cruises = data.cruises || [];
            console.log(`Found ${cruises.length} cruises on this page.`);

            // Flatten the hierarchical structure
            for (const cruise of cruises) {
                for (const cabin of cabinPriceFields) {
                    const priceStr = cruise[cabin.key];
                    if (priceStr) {
                        const price = parseFloat(priceStr);
                        if (price > 0) {
                            allOfferings.push({
                                vendor_id: cruise.vendor_id,
                                name: cruise.name,
                                ship_title: cruise.ship_title,
                                starts_on: cruise.starts_on,
                                grade_name: cabin.name,
                                price: priceStr,
                            });
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

    console.log(`Total unique cruise offerings fetched: ${allOfferings.length}`);
    return allOfferings;
}
