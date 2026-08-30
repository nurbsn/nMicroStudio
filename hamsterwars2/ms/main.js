let gra = "flymjm";


init = function() {

    player.x = 25;
    player.y = -50;
    x = -25;
    y = -50;
}

update = function() {
  
let speed = 2
  
  // Sterowanie graczem
  if (keyboard.W) y += speed
  if (keyboard.S) y -= speed
  if (keyboard.A) x -= speed
  if (keyboard.D) x += speed

  if (keyboard.ARROW_UP) player.y += speed
  if (keyboard.ARROW_DOWN) player.y -= speed
  if (keyboard.ARROW_LEFT) player.x -= speed
  if (keyboard.ARROW_RIGHT) player.x += speed
  

  
  if (gra == "flymjm") 
  {
    if (keyboard.press.ENTER) 
    {
      gra = "menu";
    }
  }
  if (gra == "menu") 
  {
    if (keyboard.press.SPACE) 
    {
      gra = "cat1";
    }
  }
  if (gra == "cat1") 
  {
    if (keyboard.Z) 
    {
      gra = "cat2";
    }
  }
  if (gra == "cat2") 
  {
    if (keyboard.X) 
    {
      gra = "cat3";
    }
  }
  if (gra == "cat3") 
  {
    if (keyboard.C) 
    {
      gra = "cat4";
    }
  }
  if (gra == "cat4") 
  {
    if (keyboard.SPACE) 
    {
      gra = "game1";
    }
  }
}


draw = function() {
  screen.clear();
  
  switch(gra) 
  {
    case "flymjm": flymjmDraw(); break;
    case "menu": menuDraw(); break;
    case "cat1": cat1Draw(); break;
    case "cat2": cat2Draw(); break;
    case "cat3": cat3Draw(); break;
    case "cat4": cat4Draw(); break;
    case "game1": game1Draw(); break;
  }
}

flymjmDraw = function() {
  screen.drawText("KANAŁ", 0, 50, 30, "rgb(255,255,255)");
  screen.drawText("FLYMJM", 0, 25, 30, "rgb(255,255,255)");
  screen.drawText("PREZENTUJE", 0, 0, 30, "rgb(255,255,255)");
  screen.drawText("[ENTER]", 0, -25, 15, "rgb(255,255,255)");
}

menuDraw = function() {
  screen.drawSprite("tlo_menu", 0, 0, 355,  215);
  screen.drawSprite("tytul", -75, 50, 200,  72);
  screen.drawSprite("start", -75, -50, 144,  36);
  screen.drawText("[SPACJA]", -70, -75, 15, "rgb(2,2,2)");
}

cat1Draw = function() {
  screen.drawSprite("cat1", 0, 0, 355,  215);
  screen.drawText("NA PEWNEJ WYSPIE CHOMIKI UROSŁY DO TAKIEGO STOPNIA ŻE...", 0, -75, 10, "rgb(0,0,0)");
  screen.drawText("BYŁY WIELKOŚĆ LUDZI...", 0, -85, 10, "rgb(0,0,0)");
  screen.drawText("[Z]", 0, -25, 15, "rgb(2,2,2)");
} 
cat2Draw = function() {
  screen.drawSprite("cat2", 0, 0, 355,  215);
  screen.drawText("... ŻYŁY W POKOJU ...", 0, -85, 10, "rgb(0,0,0)");
  screen.drawText("[X]", 0, -25, 15, "rgb(2,2,2)");
}
cat3Draw = function() {
  screen.drawSprite("cat3", 0, 0, 355,  215);
  screen.drawText("... DOPUKI JEDEN Z NICH NIE UKRADŁ ŚIWĘTEGO ORZECHA ...", 0, -85, 10, "rgb(255,255,255)");
  screen.drawText("[C]", 0, -25, 15, "rgb(255,255,255)");
}
cat4Draw = function() {
  screen.drawSprite("cat4", 0, 0, 355,  215);
  screen.drawText("... ZACZEŁA SIĘ WIELKA WOJNA POMIEDZY CHOMIKAMI DŹUNGARSKIMI I EUROPEJSKIMI.", 0, -85, 10, "rgb(0,0,0)");
  screen.drawText("[SPACE]", 0, -25, 15, "rgb(0,0,0)");
}
game1Draw = function() {
  screen.clear("rgb(85,255,0)");
  screen.drawMap("mapa", 0, 0, 355,  215);
  screen.drawSprite("player", x, y, 16, 18);
  screen.drawSprite("player2", player.x, player.y, 16, 18);
}