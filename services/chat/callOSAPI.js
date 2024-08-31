require("dotenv").config({ path: `.env` });

async function callOSAPI(endpoint, payload) { //FILL IN VARIABLES

    try {
        const myHeaders = new Headers();
        myHeaders.append("Content-Type", "application/json");
        myHeaders.append("Authorization", `Bearer ${process.env.EVEREST_API}`);

        const raw = JSON.stringify(payload);

        const requestOptions = {
            method: "POST",
            headers: myHeaders,
            body: raw,
            redirect: "follow"
        };

        // Await the fetch call to make it asynchronous

        // THIS IS THE LIVE CONFIG
        console.log(`Sending request to: ${process.env.EVEREST_API_BASE}${endpoint}`);
        const response = await fetch(`${process.env.EVEREST_API_BASE}${endpoint}`, requestOptions);

        // // THIS IS THE TEST CONFIG
        // console.log(`Sending request to: http://localhost:3321/api/${endpoint}`);
        // const response = await fetch(`http://localhost:3321/api/${endpoint}`, requestOptions);

        // console.log("\n **** \n\n WHAT IM SEEING IN THE RESPONSE IN callOSAPI IS: \n\n", response);

        // Log the result
        const result = await response.json(); // or response.text() if you expect plain text
        console.log(result);
        // console.log(result);
        return result.response;

    } catch (error) {
        // Log any errors that occur during the fetch or response processing
        console.error(error);
    }

}
module.exports = callOSAPI;