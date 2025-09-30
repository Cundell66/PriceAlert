// src/lib/cruise-api.ts

// Represents a single cabin grade with its pricing
export interface Grade {
    grade_code: string;
    grade_name: string;
    price: string;
    // other fields like availability, etc., can be added here if needed
}

// Represents a cruise from the API, containing multiple grades
export interface CruiseFromApi {
    vendor_id: string;
    name: string;
    ship_title: string;
    starts_on: string;
    grades: Grade[];
}

// Represents a flattened, unique cruise offering (1 cruise + 1 cabin grade)
// This is the structure we'll use for comparisons.
export interface CruiseOffering {
    vendor_id: string;
    grade_code: string;
    name: string;
    ship_title: string;
    starts_on: string;
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
 * into a list of unique cruise offerings (cruise + cabin grade).
 * @returns A promise that resolves to an array of all cruise offerings.
 */
export async function fetchCruises(): Promise<CruiseOffering[]> {
    let allOfferings: CruiseOffering[] = [];
    let nextUrl: string | undefined = API_ENDPOINT_URL;
    let currentUrl = '';

    while (nextUrl && nextUrl !== currentUrl) {
        currentUrl = nextUrl;
        try {
            console.log(`Fetching data from: ${nextUrl}`);
            const response = await fetch(nextUrl, { headers });
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }
            const data: ApiResponse = await response.json();
            const cruises = data.cruises || [];

            // Flatten the hierarchical structure
            for (const cruise of cruises) {
                if (cruise.grades && Array.isArray(cruise.grades)) {
                    for (const grade of cruise.grades) {
                        // Only include offerings that have a valid price
                        if (grade.price && parseFloat(grade.price) > 0) {
                            allOfferings.push({
                                vendor_id: cruise.vendor_id,
                                grade_code: grade.grade_code,
                                name: cruise.name,
                                ship_title: cruise.ship_title,
                                starts_on: cruise.starts_on,
                                grade_name: grade.grade_name,
                                price: grade.price,
                            });
                        }
                    }
                }
            }
            
            // Check for a next link that isn't the same as the current URL
            if(data._links.next) {
                nextUrl = data._links.next.href;
            } else {
                nextUrl = undefined;
            }

        } catch (error) {
            console.error("Error fetching cruises:", error);
            nextUrl = undefined; 
        }
    }

    console.log(`Total unique cruise offerings fetched: ${allOfferings.length}`);
    return allOfferings;
}
