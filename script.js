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

const CRAFT_RETURN = 0.2480
const ARTEFACT_FILES_COUNT = 9;
const ATLEAST_THIS_DAYS = 18;
const START_DAY_FOR_AVERAGE = 10;
// const ITEM_CATEGORY = "headcloth";
const MARKET_TAX = 1.08;

//! BASIC FUNCTIONS CONNECTED TO THE CORE CALCULATOR

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
            artefact_json = artefact_json.concat(await getApiData(artefact_arr,"time-scale=24&locations=Lymhurst"));
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
    const resource_price_map = await basicResourcePricesFromBestCity(true);
    const artefact_price_map = await allArtefactsPrices(true);
    const price_map = new Map([...resource_price_map,...artefact_price_map]);
    const recipe_map = await setRecipeMap();
    let item_data = await equipmentCategoryItems(category,true);

    //? SET DISPLAY NAME MAP
    const file_text = await textFromFile(`categories/${category}.txt`);
    const item_array = textToArray(file_text);
    let display_item_map = new Map();
    item_array.forEach(([id,name]) =>{
        if(name == undefined){
            name = "IDK"
        }
        display_item_map.set(id,name.trim());
    })


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
                    profit_quantity: item_data[i].profit_quantity,
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
        console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.log(`%c${item.item_id} // ${item.quality_display} // PROFIT : ${item.profit} // AVERAGE PRICE: ${item.average_price} // CRAFTING COST : ${item.crafting_cost_array}`,"color: blue; font-weight: bold;");
    }
    // //? BIG PROFIT
    // else if(item.profit_quantity > 2500000){
    //     console.log(`%c${item.item_id} // ${item.quality_display} // PROFIT&QUANTITY : ${item.profit_quantity} // AVERAGE PRICE: ${item.average_price} // CRAFTING COST : ${item.crafting_cost_array} // QUANTITY : ${item.average_quantity}`,"color: pink; font-weight: bold;");
    // }
    // //? OK PROFIT
    // else if(item.profit_quantity > 1000000){
    //     console.log(`%c${item.item_id} // ${item.quality_display} // PROFIT&QUANTITY : ${item.profit_quantity} // AVERAGE PRICE: ${item.average_price} // CRAFTING COST : ${item.crafting_cost_array} // QUANTITY : ${item.average_quantity}`,"color: greenyellow; font-weight: bold;");
    // }
    // //? L PROFIT
    // else{
    //     console.log(`%c${item.item_id} // ${item.quality_display} // PROFIT : ${item.profit} // AVERAGE PRICE: ${item.average_price} // CRAFTING COST : ${item.crafting_cost_array} // QUANTITY : ${item.average_quantity}`,"color: red; font-weight: bold;");
    // }
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





//! Interfejs

const title_underscore = document.querySelector(".title-underscore");

setInterval(() => {
    title_underscore.classList.toggle("hidden")
}, 2000);





const allEquipmentButtons = document.querySelectorAll(".equipment-button");

allEquipmentButtons.forEach(button =>{
    const buttonImg = button.querySelector("img");
    buttonImg.addEventListener("load", _ =>{
        button.addEventListener("click", e=>{
            categoryClick(e);
        })
        const newSrc = buttonImg.src.replace("?size=40", "?size=150");;
        const tempImg = new Image();
        tempImg.src = newSrc;
        tempImg.addEventListener("load", _ =>{
            buttonImg.src = newSrc;
            button.classList.remove("blur-icons")
            button.classList.add("category-hover-right");

        })

    }, {once: true})

})



async function categoryClick(e) {
    const mainContainerr = document.querySelector("main");
    mainContainerr.remove();
    document.querySelector(".flex-wrapper").insertAdjacentHTML("beforeend",`<main class="main"></main>`)
    const btn = e.target.closest(".equipment-button");
    arrowRetract();
    const data = await main(btn.dataset.apiName);
    data.sort((a,b) =>{
        if(a.profit_quantity > b.profit_quantity){
            return -1
        }
        else{
            return 1;
        }
    })
    // for(v of data){
    //     let color = ""
    //     if(v.profit_quantity <= 100){
    //         color = "rgb(230,10,10)"
    //     }
    //     else{
    //         color = "rgb(20,230,20)"
    //     }
    //     console.log(`%c${v.display_name}@${v.enchantment}`,`color: ${color}`,v);
    // }
    displayData(data);

}




const category_nav = document.querySelector(".category-nav");
document.querySelector(".category-arrow-right").addEventListener("click", e =>{
    if(!arrowIsExpanded){
        arrowExpand();
    }
    else{
        arrowRetract();
    }

})

const expand_arrow = document.querySelector(".category-arrow-right")
let arrowIsExpanded = false;
function arrowExpand(){
    arrowIsExpanded = true;
    category_nav.style.overflow = "visible";
    category_nav.classList.add("category-nav-expand")
    category_nav.classList.remove("category-nav-retract")
    allEquipmentButtons.forEach(button =>{

        button.insertAdjacentHTML("beforeend",`<span class="category-span">${button.dataset.itemName}</span>`)
    })

    expand_arrow.querySelector("img").classList.add("category-arrow-left");
}


function arrowRetract() {
    arrowIsExpanded = false;

    expand_arrow.querySelector("img").classList.remove("category-arrow-left");
    const category_spans = document.querySelectorAll(".category-span")
    category_nav.style.overflow = "hidden";
    category_nav.classList.add("category-nav-retract")
    category_nav.classList.remove("category-nav-expand")
    category_spans.forEach(span =>{
        span.remove();
    })
}

//* NARAZIE A OUT
// const znak = document.querySelector(".daj-znaka");
// window.addEventListener("scroll", e =>{

//     let topp = znak.getBoundingClientRect().top
//     if(topp< 0){

//     }
// })




function displayData(data) {
    const mainContainer = document.querySelector("main");
    data.forEach(item =>{
        const html = `
        <div class="t${item.tier} item-result">
            <img src="https://render.albiononline.com/v1/item/${item.item_id}.png?size=120&quality=${item.quality}" alt="">
            <div class="item-title-div">
                <p class="item-title">${item.display_name}</p>
                <p class="item-desc">TIER: ${item.tier}.${item.enchantment} QUALITY: ${item.quality_display}</p>
            </div>
            <div class="line"></div>
            <div class="stats">
                <div class="peritem">
                    <span>Price: <span class="bold">${item.price}</span></span>
                    <span>Craft: <span class="bold">${item.crafting_cost}</span></span>
                    <span>Profit: <span class="boldg">${item.profit}</span></span>
                    <span>Quantity: <span class="bold">${item.quantity}</span></span>
                    <span>P*Q: <span class="bold">${item.profit_quantity}</span></span>
                </div>
            </div>
        </div>`
        mainContainer.insertAdjacentHTML("beforeend",html);
    })
}
