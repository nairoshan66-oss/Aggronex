/* ================= NAVBAR MENU ================= */

function toggleNavbar(){
  let nav = document.getElementById("navLinks");
  if(nav){
    nav.classList.toggle("active");
  }
}

/* ================= SIDEBAR ================= */

function toggleSidebar(){
  let sidebar = document.getElementById("sidebar");
  if(sidebar){
    sidebar.classList.toggle("active");
  }
}

/* ================= LOGIN ================= */

function login(){
  let user=document.getElementById("username").value;
  let pass=document.getElementById("password").value;

  if(user==="admin" && pass==="1234"){
    alert("Login Successful!");
    window.location.href="/dashboard";
  }else{
    alert("Invalid Credentials!");
  }
}

/* ================= SCROLL ANIMATION ================= */

document.addEventListener("DOMContentLoaded", function(){

  const elements=document.querySelectorAll(".reveal, .zoom, .reveal-left");

  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add("active");
      }
    });
  },{threshold:0.2});

  elements.forEach(el=>{
    observer.observe(el);
  });

});

/* ================= SECTION SWITCH ================= */

function showSection(section){

  document.querySelectorAll(".section").forEach(s=>{
    s.classList.remove("active");
  });

  let activeSection=document.getElementById(section);
  if(activeSection){
    activeSection.classList.add("active");
  }

  document.querySelectorAll(".sidebar li").forEach(li=>{
    li.classList.remove("active");
  });

  let item=document.querySelector(`.sidebar li[onclick="showSection('${section}')"]`);
  if(item){
    item.classList.add("active");
  }
}

/* ================= GOOGLE MAP ================= */

let map;
let marker;

function initMap() {

  const defaultLocation = { lat: 23.0225, lng: 72.5714 };

  lat = defaultLocation.lat;
  lon = defaultLocation.lng;

  map = new google.maps.Map(document.getElementById("map"), {
    center: defaultLocation,
    zoom: 6,
  });

  // ✅ MARKER HERE
  marker = new google.maps.Marker({
    position: defaultLocation,
    map: map,
    draggable: true
  });

  // ✅ ADD THIS HERE (drag feature)
  marker.addListener("dragend", function(event) {
    updateLocationData(event.latLng.lat(), event.latLng.lng());
  });

  // ✅ CLICK EVENT
  map.addListener("click", function(event) {

    const newLat = event.latLng.lat();
    const newLon = event.latLng.lng();

    marker.setPosition({ lat: newLat, lng: newLon });

    updateLocationData(newLat, newLon);
  });
}

function updateLocationData(newLat, newLon) {

    console.log("New Location:", newLat, newLon);

    lat = newLat;
    lon = newLon;

    getWeather();
}

/* Load map when page opens */
window.addEventListener("load", function () {
    try {
        if (document.getElementById("map") && window.google && window.google.maps) initMap();
    } catch (error) {
        console.warn("Map could not be initialized:", error);
    }
    initLocation();
});
/* ================= CROP CHART ================= */

if(document.getElementById("cropChart")){

new Chart(document.getElementById("cropChart"),{

type:'doughnut',

data:{
labels:['Wheat','Corn','Barley','Paddy'],

datasets:[{
data:[50,15.5,14.2,6.7],
backgroundColor:[
'#4CAF50',
'#FF9800',
'#E53935',
'#8E24AA'
]
}]
}

});

}

/* ================= COST CHART ================= */

if(document.getElementById("costChart")){

new Chart(document.getElementById("costChart"),{

type:'line',

data:{
labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct'],

datasets:[{
label:'Farm Cost',
data:[100,200,150,300,210,260,220,386,310,330],
borderColor:'#4CAF50',
tension:0.4
}]
}

});

}

/* ================= WEATHER API ================= */

/* ================= LIVE WEATHER ================= */

let lat = null;
let lon = null;

/* Get location ONLY once */
function initLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            lat = position.coords.latitude;
            lon = position.coords.longitude;
            getWeather();
        }, () => {
            lat = null;
            lon = null;
            getWeather(); // The API falls back to Ahmedabad if location is unavailable.
        }, { timeout: 8000, maximumAge: 600000 });
    } else {
        getWeather();
    }
}

/* Fetch weather using saved lat/lon */ 
async function getWeather() {
    try {
        const params = new URLSearchParams();
        if (lat !== null && lon !== null) {
            params.set("lat", lat);
            params.set("lon", lon);
        }
        const weatherStatus = document.getElementById("weatherStatus");
        const res = await fetch(`/api/live-data${params.size ? `?${params}` : ""}`);
        let data = await res.json();
        if (!res.ok || data.error) {
            if (weatherStatus) weatherStatus.textContent = data.error || "Weather could not be loaded.";
            ["temperature", "humidity", "wind"].forEach((id) => {
                const element = document.getElementById(id);
                if (element) element.textContent = "--";
            });
            return;
        }
        if (weatherStatus) weatherStatus.textContent = data.location ? `Current weather for ${data.location}` : "";
        let temp = data.temperature;
        let humidityVal = data.humidity;

// 🌱 AI suggestion
let result = getCropSuggestion(temp, humidityVal);

if(document.getElementById("cropSuggestion")){
    document.getElementById("cropSuggestion").innerText = result.crops;
}

if(document.getElementById("cropTagline")){
    document.getElementById("cropTagline").innerText = result.message;
}

        if(document.getElementById("temperature")){
            document.getElementById("temperature").innerText = data.temperature + " °C";
        }

        if(document.getElementById("humidity")){
            document.getElementById("humidity").innerText = data.humidity + " %";
        }

        if(document.getElementById("wind")){
            document.getElementById("wind").innerText = data.wind + " km/h";
        }

    } catch(error){
        console.log("Weather Fetch Error:", error);
        const weatherStatus = document.getElementById("weatherStatus");
        if (weatherStatus) weatherStatus.textContent = "Weather could not be loaded. Please try again later.";
    }
}

/* OpenWeather recommends spacing requests for the same location by 10 minutes. */
setInterval(getWeather, 10 * 60 * 1000);

/* ================= DASHBOARD DATA ================= */

// Example records give the dashboard useful content on first visit.
let fields=[
  {name:"North Field",crop:"Wheat"},
  {name:"Riverside Plot",crop:"Maize"},
  {name:"Orchard Block",crop:"Tomatoes"}
];
let jobs=["Irrigate North Field","Inspect maize crop","Apply organic fertilizer"];
let completedJobs=0;
let completedJobList=[];
let teamMembers=["Aarav Patel — Farm Manager","Maya Shah — Crop Specialist","Rohan Mehta — Irrigation Technician"];

function updateDashboard(){

if(document.getElementById("fieldCount")){
document.getElementById("fieldCount").innerText=fields.length;
}

if(document.getElementById("activeJobs")){
document.getElementById("activeJobs").innerText=jobs.length;
}

if(document.getElementById("jobsDue")){
document.getElementById("jobsDue").innerText=jobs.length;
}

if(document.getElementById("jobsCompleted")){
document.getElementById("jobsCompleted").innerText=completedJobs;
}

}

/* ================= FIELDS ================= */

function addField(){

let name=document.getElementById("fieldName").value;
let crop=document.getElementById("cropType").value;

if(name=="" || crop=="") return;

fields.push({name,crop});

renderFields();
updateDashboard();

document.getElementById("fieldName").value="";
document.getElementById("cropType").value="";

}

function renderFields(){

let table=document.getElementById("fieldTable");

if(!table) return;

table.innerHTML="";

fields.forEach((f,i)=>{

table.innerHTML+=`
<tr>
<td>${f.name}</td>
<td>${f.crop}</td>
<td><button class="deleteBtn" onclick="deleteField(${i})">Delete</button></td>
</tr>
`;

});

}

function deleteField(i){

fields.splice(i,1);

renderFields();
updateDashboard();

}

/* ================= JOBS ================= */

function addJob(){

let name=document.getElementById("jobName").value;

if(name=="") return;

jobs.push(name);

renderJobs();
updateDashboard();

document.getElementById("jobName").value="";

}

function renderJobs(){

let table=document.getElementById("jobTable");

if(!table) return;

table.innerHTML="";

jobs.forEach((j,i)=>{

table.innerHTML+=`

<tr>
<td>${j}</td>

<td>
<button onclick="completeJob(${i})">Complete</button>
<button class="deleteBtn" onclick="deleteJob(${i})">Delete</button>
</td>

</tr>

`;

});

}

function renderCompletedJobs(){

let table=document.getElementById("completedJobTable");

if(!table) return;

table.innerHTML="";

completedJobList.forEach(job=>{

table.innerHTML+=`

<tr>
<td>${job}</td>
<td><span class="completedStatus">Completed</span></td>
</tr>

`;

});

}

function deleteJob(i){

jobs.splice(i,1);

renderJobs();
updateDashboard();

}

function completeJob(i){

let job=jobs[i];

jobs.splice(i,1);

completedJobList.push(job);

completedJobs++;

renderJobs();
renderCompletedJobs();
updateDashboard();

}

/* ================= TEAM ================= */

function addMember(){

let name=document.getElementById("memberName").value;

if(name=="") return;

teamMembers.push(name);
renderTeam();

document.getElementById("memberName").value="";

}

function renderTeam(){
  const list=document.getElementById("teamList");
  if(!list) return;
  list.innerHTML="";
  teamMembers.forEach((member,index)=>{
    const li=document.createElement("li");
    li.append(document.createTextNode(member+" "));
    const button=document.createElement("button");
    button.textContent="Remove";
    button.addEventListener("click",()=>{
      teamMembers.splice(index,1);
      renderTeam();
    });
    li.appendChild(button);
    list.appendChild(li);
  });
}

/* ================= VEHICLES ================= */

function addVehicle(){

let name=document.getElementById("vehicleName").value;

if(name=="") return;

let list=document.getElementById("vehicleList");

let li=document.createElement("li");

li.innerHTML=name+" <button onclick='this.parentElement.remove()'>Remove</button>";

list.appendChild(li);

document.getElementById("vehicleName").value="";

}

/* ================= INIT ================= */

renderFields();
renderJobs();
renderCompletedJobs();
renderTeam();
updateDashboard();

function uploadSoil() {
    const fileInput = document.getElementById("soilImage");
    const file = fileInput.files[0];

    const formData = new FormData();
    formData.append("image", file);

    fetch("/api/analyze-image", {
        method: "POST",
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById("soil-result").innerHTML = `
            <p><b>Soil Type:</b> ${data.soil}</p>
            <p><b>Crop:</b> ${data.crop}</p>
            <p><b>Fertilizer:</b> ${data.fertilizer}</p>
        `;
    });
}
function getCropSuggestion(temp, humidity) {

    if (temp >= 25 && temp <= 35 && humidity >= 40 && humidity <= 70) {
        return {
            crops: "🌽 Maize, 🌿 Cotton, 🥜 Groundnut",
            message: "Ideal warm conditions with balanced humidity."
        };
    }

    if (temp < 20) {
        return {
            crops: "🌾 Wheat, 🌿 Barley",
            message: "Cool climate supports winter crops."
        };
    }

    if (humidity > 70) {
        return {
            crops: "🌾 Rice, 🌱 Sugarcane",
            message: "High humidity favors water crops."
        };
    }

    return {
        crops: "🌱 Mixed Crops",
        message: "Moderate conditions suitable for farming."
    };
}
