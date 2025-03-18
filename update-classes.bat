@echo off
echo Updating class names in section files...

:: Replace class="section-content" with class="section-wrapper" in book.html
powershell -Command "(Get-Content book.html) -replace 'class=\"section-content\"', 'class=\"section-wrapper\"' | Set-Content book.html"

:: Replace class="content-section" with class="content-block" in all section HTML files
cd sections
for %%f in (*.html) do (
    powershell -Command "(Get-Content %%f) -replace 'class=\"content-section\"', 'class=\"content-block\"' | Set-Content %%f"
)
cd ..

:: Update class references in JavaScript files
powershell -Command "(Get-Content js\core\content-module.js) -replace '\.section-content', '.section-wrapper' | Set-Content js\core\content-module.js"
powershell -Command "(Get-Content js\visualization\visualization-engine.js) -replace '\.section-content', '.section-wrapper' | Set-Content js\visualization\visualization-engine.js"
powershell -Command "(Get-Content js\visualization\visualization-engine.js) -replace '\.content-section', '.content-block' | Set-Content js\visualization\visualization-engine.js"

echo Class name update complete!