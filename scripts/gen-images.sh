#!/bin/bash
cd /home/z/my-project
P="public/images"
z-ai image -p "Overhead shot of a vibrant West African Ghanaian feast on rustic dark wood table: jollof rice in clay bowl, grilled chicken, fried plantains, palava sauce, warm natural light, professional food photography, rich colors, high quality" -o "$P/hero-1.png" -s 1440x720 > /tmp/img1.log 2>&1
z-ai image -p "Boiled yam and golden fried plantain slices served with dark green Ghanaian palava sauce in ceramic bowl, with smoked fish, rustic cream linen tablecloth, soft window light, professional food photography, appetizing, high quality" -o "$P/palava.png" -s 1024x1024 > /tmp/img2.log 2>&1
z-ai image -p "Ghanaian vegetable stew with yam: boiled white yam slices with rich red-orange tomato vegetable stew with greens, ceramic plate on cream table, natural light, professional food photography, appetizing, high quality" -o "$P/veg-stew.png" -s 1024x1024 > /tmp/img3.log 2>&1
z-ai image -p "Ghanaian jollof rice with fried chicken: orange-red smoky jollof rice in white bowl, crispy fried chicken thigh, sliced tomatoes and onions garnish, warm restaurant lighting, professional food photography, high quality" -o "$P/jollof-chicken.png" -s 1024x1024 > /tmp/img4.log 2>&1
z-ai image -p "Ghanaian jollof rice with boiled egg: orange-red party jollof rice plated with halved boiled egg, onion tomato garnish, cream ceramic plate, soft natural light, professional food photography, high quality" -o "$P/jollof-egg.png" -s 1024x1024 > /tmp/img5.log 2>&1
z-ai image -p "Omo tuo Ghanaian rice balls with groundnut soup: three smooth white rice balls in bowl of rich brown groundnut soup, rustic wooden table, clay bowl, warm light, professional food photography, appetizing, high quality" -o "$P/rice-balls.png" -s 1024x1024 > /tmp/img6.log 2>&1
z-ai image -p "African chef in white apron plating beautiful traditional Ghanaian dishes in warm modern restaurant kitchen, steam rising, golden hour light through window, cinematic, professional photography, high quality" -o "$P/brand-story.png" -s 1344x768 > /tmp/img7.log 2>&1
z-ai image -p "Close-up of Ghanaian groundnut soup being poured over rice balls, rich glossy peanut soup, dark moody food photography with warm highlights, rustic setting, high quality" -o "$P/rice-balls-2.png" -s 1024x1024 > /tmp/img8.log 2>&1
echo "ALL DONE" > /tmp/imgdone.flag
