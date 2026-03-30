`use strict`

//! GLOBAL
const qualityDisplayMap = new Map([
  [1,"Normal"],
  [2,"Good"],
  [3,"Outstanding"],
  [4,"Excellent"],
  [5,"Masterpiece"],
]);

const cityRules = {
    "Lymhurst": "CLOTH",
    "Fort Sterling": "PLANKS",
    "Thetford": "METAL",
    "Martlock": "LEATHER",
    "Bridgewatch": "STONE"
};


let MARKET_TAX = 1.08;
let CRAFT_RETURN = 0.248;
let ARTEFACT_CITY = "Lymhurst";
let SELL_CITY = "Brecilien";

const ARTEFACT_FILES_COUNT = 9;
const ATLEAST_THIS_DAYS = 18;
const START_DAY_FOR_AVERAGE = 10;


//! BASIC FUNCTIONS CONNECTED TO THE CORE CALCULATOR

function calculateCraftReturn(focus,city_bonus,daily_bonus) {
    let first_part = 0.152;
    let second_part = 0;
    if(city_bonus){
        switch (daily_bonus) {
            case 0:
                first_part = 0.248;
                break;
            case 0.1:
                first_part = 0.3;
                break;
            case 0.2:
                first_part = 0.346;
                break;
            default:
                break;
        }
    }
    else{
        switch (daily_bonus) {
            case 0.1:
                first_part = 0.218;
                break;
            case 0.2:
                first_part = 0.275;
                break;
            default:
                break;
        }
    }

    if (focus) {
        if(city_bonus){
            switch (daily_bonus) {
                case 0:
                    second_part = 0.231;
                    break;
                case 0.1:
                    second_part = 0.204;
                    break;
                case 0.2:
                    second_part = 0.182;
                    break;
                default:
                    break;
            }
        }
        else{
            switch (daily_bonus) {
                case 0:
                    second_part = 0.283;
                    break;
                case 0.1:
                    second_part = 0.247;
                    break;
                case 0.2:
                    second_part = 0.217;
                    break;
                default:
                    second_part = 0;
                    break;
            }
        }
    }

    return first_part+second_part;

}


async function textFromFile(file_name){
    const file = await fetch(`itemstxt/${file_name}`);
    return await file.text();

}

async function jsonFromFile(file_name) {
    const file = await fetch(`itemstxt/${file_name}`);
    return await file.json();
}

function textToArray(text){
    return text.trim().split("\n").map(line => line.split(":"));
}

function calcAverage(arr,days){
    let sumQ = 0;
    let sumP = 0;
    let count = 0;
    for(let i = days; i < arr.length-1; i++){
        sumQ += arr[i].item_count;
        sumP += arr[i].avg_price;
        count++;
    }
    if (count === 0) return [0, 0];
    const avgQ = Math.floor(sumQ/count);
    const avgP = Math.floor(sumP/count);

    return [avgQ,avgP];
}

//! -------------------------------------------------------------------------------------------------- INTERACT WITH API


//? HELPER FUNCTION
async function getApiData(item_array, params){
    const url = `https://europe.albion-online-data.com/api/v2/stats/history/${item_array.map(x => x[0].trim()).join()}?${params}`;

    try{
        const res = await fetch(url);
        if(!res.ok){
            throw new Error(`HTTP : ${res.status}`)
        }
        const res_json = await res.json();
        // console.log(res_json);

        return res_json;
    }
    catch(e){
        console.log(e);
        console.log("Failed to fetch from API!");
        return
    }
}

//? HELPER FUNCTION FOR NOW ONLY USED FOR CAPES MAY CHANGE WITH GAME UPDATES
async function getCombinedApiData(length, name, city){
    let final_table = [];
    for(let i = 1; i <= length; i++){
        const item_text = await textFromFile(`categories/${name}${i}.txt`)
        const item_array = textToArray(item_text);

        final_table = final_table.concat(await getApiData(item_array,`time-scale=24&locations=${city}&qualities=2,3,4`));

    }
    return final_table;
}

//? RESOURCES LIKE METAL AND PLANKS
async function basicResourcePricesFromBestCity(should_fetch){
    let resource_json =[];

    if(should_fetch){
        //* DOWNLOAD FROM API
        let resource_text = await textFromFile("resource.txt");
        let resource_arr = textToArray(resource_text)
        resource_json = await getApiData(resource_arr,`time-scale=24&locations=Lymhurst,Bridgewatch,Thetford,Martlock,FortSterling`);
    }
    else{
        //* LOCAL FILE FOR DEVELOPMENT TO NOT EXPLOIT THE API CONSTANTLY
        resource_json = await jsonFromFile("dev/resource.json");
    }

    let resource_map = new Map();
    for(let i = 0; i < resource_json.length; i++){
        [resource_json[i].average_quantity, resource_json[i].average_price] = calcAverage(resource_json[i].data,0)
        const rule = cityRules[resource_json[i].location];

        if (rule && resource_json[i].item_id.includes(rule)) {
            if(resource_json[i].item_id.includes("@")){
                resource_map.set(resource_json[i].item_id.split("@")[0],resource_json[i].average_price);
            }
            else{
                resource_map.set(resource_json[i].item_id,resource_json[i].average_price);
            }
        }
    }
    return resource_map
}


//? ARTEFACTS FOR EVERYTHING
async function allArtefactsPrices(should_fetch){
    let artefact_json = [];

    if(should_fetch){
        //* DOWNLOAD FROM API
        for(let i = 1; i <= ARTEFACT_FILES_COUNT; i++){
            let artefact_text = await textFromFile(`artefact${i}.txt`);
            let artefact_arr = textToArray(artefact_text)
            artefact_json = artefact_json.concat(await getApiData(artefact_arr,`time-scale=24&locations=${ARTEFACT_CITY}`));
        }
    }
    else{
        //* LOCAL FILE FOR DEVELOPMENT TO NOT EXPLOIT THE API CONSTANTLY
        artefact_json = await jsonFromFile("dev/artefact.json");
    }

    let artefact_map = new Map();
    for(let i = 0; i < artefact_json.length; i++){
        [artefact_json[i].average_quantity, artefact_json[i].average_price] = calcAverage(artefact_json[i].data,0)
        artefact_map.set(artefact_json[i].item_id,artefact_json[i].average_price);
    }
    return artefact_map
}


//? THE ITEMS THAT THE PLAYER SELLS AFTER CRAFT
async function equipmentCategoryItems(category, should_fetch, city="Brecilien"){
    let data = [];
    if(should_fetch){
        //* DOWNLOAD FROM API
        const file_text = await textFromFile(`categories/${category}.txt`);
        const item_array = textToArray(file_text);

        if(item_array.length === 2){
            data = await getCombinedApiData(parseInt(item_array[0]),item_array[1],city);
        }
        else{
            data = await getApiData(item_array,`time-scale=24&locations=${city}&qualities=2,3,4`);
        }
    }
    else{
        // * LOCAL FILE FOR DEVELOPMENT TO NOT EXPLOIT THE API CONSTANTLY
        data = await jsonFromFile("dev/armorplate.json");
    }

    return data
}
//! -------------------------------------------------------------------------------------------------- INTERACT WITH API END

async function main(category) {

    //? GET PRICES
    let refined_data = [];
    console.log("fetching resources");
    const resource_price_map = await basicResourcePricesFromBestCity(true);
    console.log("fetching artefacts");
    const artefact_price_map = await allArtefactsPrices(true);
    console.log("fetching artefacts");
    const price_map = new Map([...resource_price_map,...artefact_price_map]);
    const recipe_map = await setRecipeMap();
    let item_data = await equipmentCategoryItems(category,true,SELL_CITY);
    console.log("fetching weapons");

    //? SET DISPLAY NAME MAP
    const file_text = await textFromFile(`categories/${category}.txt`);
    const item_display_array = textToArray(file_text);
    let concat_item_arr = [];
    //? Only for capes now due to being so many capes it needs to be split across multiple requests
    if(item_display_array.length == 2){
        const length = Number.parseInt(item_display_array[0]);
        for (let i = 1; i <= length; i++) {
            const concat_file_text = await textFromFile(`categories/${category}${i}.txt`);
            console.log(concat_file_text);
            const concat_display_item_arr = textToArray(concat_file_text);
            concat_item_arr = concat_item_arr.concat(concat_display_item_arr)
        }
    }
    const display_item_map = setDisplayMap(concat_item_arr.length !== 0 ? concat_item_arr : item_display_array);
    //? SET REFINED DATA
    for(let i = 0; i < item_data.length; i++){
        if(item_data[i].data.length < ATLEAST_THIS_DAYS){
            continue
        }
        setItemAdditionalData(item_data[i], recipe_map);
        if(item_data[i].recipe != undefined){
            calcProfit(item_data[i], price_map, CRAFT_RETURN)
            logConsoleInfoAboutItemProfit(item_data[i]);
            if(!Number.isNaN(item_data[i].profit_quantity)){
                    refined_data.push({
                    quality: item_data[i].quality,
                    quality_display: item_data[i].quality_display,
                    price: item_data[i].average_price,
                    quantity: item_data[i].average_quantity,
                    crafting_cost_array: item_data[i].crafting_cost_array,
                    enchantment: item_data[i].enchantment,
                    item_id: item_data[i].item_id,
                    profit: item_data[i].profit,
                    profit_quantity: Math.trunc(item_data[i].profit_quantity),
                    crafting_cost: item_data[i].crafting_cost,
                    display_name: display_item_map.get(item_data[i].item_id),
                    tier: +item_data[i].item_id[1],
                });
            }
        }
        else{
            console.log(`No recipe for: ${item_data[i].item_id}`);
        }
    }
    return refined_data;
}

function logConsoleInfoAboutItemProfit(item){

    if(Number.isNaN(item.profit_quantity)){
        console.log("Go to market if you have Albion Data Client, go into buy order and update the item/artifact:");
        console.log(`%c${item.item_id} // ${item.quality_display} // PROFIT : ${item.profit} // AVERAGE PRICE: ${item.average_price} // CRAFTING COST : ${item.crafting_cost_array}`,"color: blue; font-weight: bold;");
    }
}

async function setRecipeMap(){
    let item_json_data = (await jsonFromFile("items.json")).items;
    let recipe_map = new Map();

    const all_items = [...item_json_data.equipmentitem,...item_json_data.weapon]
        for(let i = 0; i < all_items.length; i++){
            if(all_items[i]["craftingrequirements"] != undefined){
                if(all_items[i]["craftingrequirements"].length >= 2){
                    recipe_map.set(all_items[i]["@uniquename"],[all_items[i]["craftingrequirements"][0]["craftresource"],all_items[i]["enchantments"]])

                }
                else{
                    recipe_map.set(all_items[i]["@uniquename"],[all_items[i]["craftingrequirements"]["craftresource"],all_items[i]["enchantments"]])
                }

            }
    }

    return recipe_map
}

function calcProfit(item, price_map, crafting_return){
    if(Array.isArray(item.recipe)){
        item.crafting_cost = 0;
        item.crafting_cost_array = [];

        for(const ingriedient of item.recipe){
            let ingr_name = ingriedient["@uniquename"];
            if(ingriedient["@enchantmentlevel"] > 0 && ingriedient["@preservequality"] === "true"){
                ingr_name = [ingriedient["@uniquename"] , ingriedient["@enchantmentlevel"]].join("@")

            }

            if(ingriedient["@maxreturnamount"] !== "0"){
                item.crafting_cost += parseInt(ingriedient["@count"]) * price_map.get(ingr_name) * (1-crafting_return);
                item.crafting_cost_array.push(Math.floor(parseInt(ingriedient["@count"]) * price_map.get(ingr_name) * (1-crafting_return)));
            }
            else{
                item.crafting_cost += parseInt(ingriedient["@count"]) * price_map.get(ingr_name)
                item.crafting_cost_array.push(Math.floor(parseInt(ingriedient["@count"]) * price_map.get(ingr_name)));
            }


        }

    }
    else{
        item.crafting_cost = parseInt(item.recipe["@count"]) * price_map.get(item.recipe["@uniquename"]);
        item.crafting_cost_array = [parseInt(item.recipe["@count"]) * price_map.get(item.recipe["@uniquename"])];
        if(item.recipe["@maxreturnamount"] !== '0'){
            item.crafting_cost *= 1-crafting_return;
        }
    }
    item.crafting_cost = Math.floor(item.crafting_cost)

    item.profit = Math.floor((item.average_price * MARKET_TAX) - item.crafting_cost);
    item.profit_quantity = item.profit * (item.average_quantity/4);
}

function setItemAdditionalData(item, recipe_map){

    [item.average_quantity, item.average_price] = calcAverage(item.data,START_DAY_FOR_AVERAGE)
    item.quality_display = qualityDisplayMap.get(item.quality);

    if(item.item_id.includes("@")){
        item.enchantment = parseInt(item.item_id.split("@")[1]);
        const core_item_name = item.item_id.split("@")[0];

        if(recipe_map.get(core_item_name)[1].enchantment[item.enchantment-1].craftingrequirements.length >=2){
            item.recipe = recipe_map.get(core_item_name)[1].enchantment[item.enchantment-1].craftingrequirements[0].craftresource;
        }
        else{
            item.recipe = recipe_map.get(core_item_name)[1].enchantment[item.enchantment-1].craftingrequirements.craftresource;
        }

    }
    else{
        item.enchantment = 0;
        item.recipe = recipe_map.get(item.item_id)[0];
    }
}

//! ----------------------------------------------------------------------------------------------------------------------------------------
//! Interfejs

const title_underscore = document.querySelector(".title-underscore");
const loading_screen = document.querySelector(".loading-screen");
const allEquipmentButtons = document.querySelectorAll(".equipment-button");
const settings_btn = document.querySelector(".settings-btn")
const settings_close_btn = document.querySelector(".settings-close-btn");
const settings_wrapper = document.querySelector(".settings-wrapper")

setInterval(() => {
    title_underscore.classList.toggle("hidden")
}, 2000);


allEquipmentButtons.forEach(button =>{
    button.insertAdjacentHTML("beforeend",`<span class="category-span" style="width: 100%; text-align: left;">${button.dataset.itemName}</span>`)
    button.addEventListener("click", e=>{
        categoryClick(e);
    })
})

async function categoryClick(e) {
    loading_screen.classList.remove("hidden");
    allEquipmentButtons.forEach(button =>{
        button.classList.remove("selected")
    })
    const mainContainerr = document.querySelector("main");
    mainContainerr.remove();
    document.querySelector(".flex-wrapper").insertAdjacentHTML("beforeend",`<main class="main"></main>`)
    const btn = e.target.closest(".equipment-button");
    btn.classList.add("selected");
    // arrowRetract();
    const data = await main(btn.dataset.apiName);
    data.sort((a,b) =>{
        if(a.profit_quantity > b.profit_quantity){
            return -1
        }
        else{
            return 1;
        }
    })
    await displayData(data);
}

async function displayData(data) {
    const mainContainer = document.querySelector("main");
    data.forEach(async item =>{
        let result = document.createElement("div");
        result.classList.add("item-result");
        result.classList.add(`t${item.tier}-glow`)
        const html = `
        <div class="item-result-top">
            <div class="item-result-img">
                <img class="result-img blur" src="img/download.svg" width="60px" alt="">
            </div>
            <div class="item-result-title-div">
                <span class="item-result-title">${item.display_name}</span>
                <span class="item-result-tier t${item.tier}-text">TIER ${item.tier}.${item.enchantment}</span>
            </div>
        </div>
        <div class="item-result-bottom">
            <div class="label-value price-div">
                <span class="item-result-label">PRICE</span>
                <span class="item-result-value">${item.price}</span>
            </div>
            <div class="label-value craft-div">
                <span class="item-result-label">CRAFT</span>
                <span class="item-result-value">${item.crafting_cost}</span>
            </div>
            <div class="label-value profit-div">
                <span class="item-result-label">PROFIT</span>
                <span class="item-result-value">${item.profit}</span>
            </div>
            <div class="label-value quantity-div">
                <span class="item-result-label">QUANTITY</span>
                <span class="item-result-value">${item.quantity}</span>
            </div>
            <div class="pq-div"><span class="item-result-label">Net Value (Profit*Quantity):</span><span class="item-result-value">${numberWithCommas(item.profit_quantity)}</span></div>
        </div>`
        result.insertAdjacentHTML("beforeend",html);
        mainContainer.appendChild(result);
        let tempImg = new Image();
        tempImg.src = `https://render.albiononline.com/v1/item/${item.item_id}.png?size=100&quality=4`;
        await tempImg.decode();
        console.log("abc");

        result.querySelector(".result-img").replaceWith(tempImg);
        tempImg.classList.remove("blur");


    })
    setTimeout(() => {
        loading_screen.classList.add("hidden");
    }, 200);
}

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}


function setDisplayMap(item_array) {
    let display_item_map = new Map();
    item_array.forEach(([id,name]) =>{
        if(name == undefined){
            name = "IDK"
        }
        display_item_map.set(id,name.trim());
    })
    return display_item_map
}


settings_btn.addEventListener("click", e=>{
    settings_wrapper.classList.remove("hidden");
})

settings_close_btn.addEventListener("click", e=>{
    settings_wrapper.classList.add("hidden");
})

const settings_bg = document.querySelector(".settings-wrapper")

settings_bg.addEventListener("click", e=>{
    if(e.target === settings_bg){
        settings_wrapper.classList.add("hidden");
    }
})

const dropdown_btns = document.querySelectorAll(".btn-dropdown");

dropdown_btns.forEach(btn =>{
    btn.addEventListener("click", e=>{
        btn.closest(".city-wrapper").querySelector(".city-dropdown").classList.toggle("hidden");
    })
})

city_dropdown_select_btns = document.querySelectorAll(".city-dropdown-select-btn");

city_dropdown_select_btns.forEach(btn =>{
    btn.addEventListener("click", e=>{
        btn.closest(".city-wrapper").querySelector(".btn-dropdown").querySelector("span").textContent = btn.textContent
        btn.closest(".city-wrapper").querySelector(".city-dropdown").classList.toggle("hidden");
    })
})

const apply_btn = document.querySelector(".btn-save")
const premium_chkbox = document.querySelector("#premium-chkbox");
const focus_chkbox = document.querySelector("#focus-chkbox");
const city_chkbox = document.querySelector("#city-chkbox");
const bonus_input = document.querySelector("#bonus-input");
apply_btn.addEventListener("click", e=>{
    if(bonus_input.value == ""){

    }
    else if ((bonus_input.value != 0 && bonus_input.value != 10 && bonus_input.value != 20)) {
        return;
    }

    MARKET_TAX = premium_chkbox.checked ? 1.04 : 1.08;
    CRAFT_RETURN = calculateCraftReturn(focus_chkbox.checked,city_chkbox.checked,bonus_input.value/100);
    ARTEFACT_CITY = document.querySelector(".artefact-city-btn-dropdown").querySelector("span").textContent;
    SELL_CITY = document.querySelector(".sell-city-btn-dropdown").querySelector("span").textContent;
    settings_wrapper.classList.add("hidden");
})
