// src/lib/cruise-api.ts

export interface Cruise {
    vendor_id: string;
    name: string;
    ship_title: string;
    starts_on: string;
    inside_price: string;
    outside_price: string;
    balcony_price: string;
    suite_price: string;
}

interface ApiResponse {
    cruises: Cruise[];
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
 * Fetches all cruises from the paginated API.
 * @returns A promise that resolves to an array of all cruises.
 */
export async function fetchCruises(): Promise<Cruise[]> {
    let allCruises: Cruise[] = [];
    let nextUrl: string | undefined = API_ENDPOINT_URL;

    while (nextUrl) {
        try {
            console.log(`Fetching data from: ${nextUrl}`);
            const response = await fetch(nextUrl, { headers });
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }
            const data: ApiResponse = await response.json();
            allCruises = allCruises.concat(data.cruises);
            
            // Check for a next link that isn't the same as the current URL to avoid infinite loops on some APIs
            if(data._links.next && data._links.next.href !== nextUrl) {
                nextUrl = data._links.next.href;
            } else {
                nextUrl = undefined;
            }

        } catch (error) {
            console.error("Error fetching cruises:", error);
            // Stop fetching if an error occurs on any page
            nextUrl = undefined; 
        }
    }

    console.log(`Total cruises fetched: ${allCruises.length}`);
    return allCruises;
}
