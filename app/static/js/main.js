document.addEventListener('DOMContentLoaded', () => {

    const mainScreen = document.getElementById("main_screen");

    let controlMode = false;


    console.log("WMS Dashboard JS Loaded");

    // EC2 WebSocket 연결
    const ws = new WebSocket("ws://" + window.location.host + "/ws");

    ws.onopen = () => {
        console.log("[CLIENT] WebSocket connected to EC2");
        ws.send("init_request");
    };

});
