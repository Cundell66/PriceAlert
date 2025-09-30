
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

            const responseText = await response.text();
            console.log(`DEBUG: Raw API response text from ${currentUrl}:`, responseText.substring(0, 500) + '...');
            
            const data: ApiResponse = JSON.parse(responseText);
            console.log('DEBUG: Parsed JSON data:', data);

            const cruises = data.cruises || [];
            console.log(`DEBUG: Found ${cruises.length} cruises on this page.`);

            // Flatten the hierarchical structure
            for (const cruise of cruises) {
                if (cruise.grades && Array.isArray(cruise.grades)) {
                    for (const grade of cruise.grades) {
                        console.log('DEBUG: Processing grade:', grade);
                        // Only include offerings that have a valid price and grade info
                        if (grade.price && parseFloat(grade.price) > 0 && grade.grade_code && grade.grade_name) {
                            allOfferings.push({
                                vendor_id: cruise.vendor_id,
                                name: cruise.name,
                                ship_title: cruise.ship_title,
                                starts_on: cruise.starts_on,
                                grade_code: grade.grade_code,
                                grade_name: grade.grade_name,
                                price: grade.price,
                            });
                        } else {
                            console.log('DEBUG: Skipping grade due to missing price or grade info:', grade);
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

