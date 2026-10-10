import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const program = new Command();

// Опис програми
program
  .name('disk-catalog')
  .description('CLI-утиліта для аналізу каталогу на диску (Лабораторна 3)')
  .version('1.0.0');

// Обов'язкова опція: шлях до JSON-файлу
program
  .option('-f, --file <path>', 'Шлях до JSON-файлу з даними', 'data.json');

// Допоміжна функція для читання файлу
function readData(options) {
  const filePath = resolve(options.file);

  if (!existsSync(filePath)) {
    console.error(`Помилка: Файл не знайдено за шляхом ${filePath}`);
    process.exit(1);
  }

  try {
    const rawData = readFileSync(filePath, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error(`Помилка: Неможливо розпарсити JSON у файлі ${filePath}`);
    process.exit(1);
  }
}

// ----------------------------------------------------
// Частина 3. Загальні можливості
// ----------------------------------------------------

// 1. Перелік (показати список елементів у поточній папці)
program
  .command('list')
  .description('Показати список елементів (вміст папки)')
  .option('-l, --limit <number>', 'Обмежити кількість елементів')
  .action((options) => {
    const opts = program.opts();
    const data = readData(opts);

    if (!data.contents || !Array.isArray(data.contents)) {
        console.error('Помилка: Кореневий елемент не має вмісту (contents)');
        process.exit(1);
    }

    let items = data.contents;
    if (options.limit) {
        const limitNum = parseInt(options.limit, 10);
        if (isNaN(limitNum) || limitNum <= 0) {
            console.error('Помилка: Ліміт має бути додатнім числом.');
            process.exit(1);
        }
        items = items.slice(0, limitNum);
    }

    console.log(`\nВміст каталогу "${data.name}":`);
    items.forEach((item, index) => {
        console.log(`[${index + 1}] ${item.name} (${item.type})`);
    });
  });

// 2. Один елемент (показати інформацію про елемент за іменем)
program
  .command('item <name>')
  .description('Показати повну інформацію про конкретний елемент')
  .action((name) => {
    const opts = program.opts();
    const data = readData(opts);

    const item = data.contents?.find(i => i.name === name);
    if (!item) {
        console.error(`Помилка: Елемент з іменем "${name}" не знайдено.`);
        process.exit(1);
    }
    console.log('\nДетальна інформація:');
    console.log(JSON.stringify(item, null, 2));
  });

// 3. Окреме поле (показати конкретну властивість кореневого каталогу)
program
  .command('field <fieldName>')
  .description('Показати значення окремого поля кореневого каталогу')
  .action((fieldName) => {
    const opts = program.opts();
    const data = readData(opts);

    if (!(fieldName in data)) {
        console.log(`Поле "${fieldName}" відсутнє у кореневому каталозі (undefined).`);
        return;
    }

    const value = data[fieldName];
    if (value === null) {
        console.log(`Значення поля "${fieldName}": null`);
    } else if (typeof value === 'object') {
        console.log(`Значення поля "${fieldName}": [Вкладений об'єкт/масив]`);
    } else {
        console.log(`Значення поля "${fieldName}": ${value}`);
    }
  });

// ----------------------------------------------------
// Частина 4. Можливості варіанта 3 (Каталог на диску)
// ----------------------------------------------------

// 1. Вміст вкладеної папки з можливістю показати приховані елементи
program
  .command('folder-content <folderName>')
  .description('Показати вміст вкладеної папки')
  .option('-s, --show-hidden', 'Показувати приховані файли та папки')
  .action((folderName, options) => {
    const opts = program.opts();
    const data = readData(opts);

    const targetFolder = data.contents?.find(i => i.name === folderName && i.type === 'folder');
    if (!targetFolder) {
        console.error(`Помилка: Папку "${folderName}" не знайдено.`);
        process.exit(1);
    }

    console.log(`\nВміст папки "${folderName}":`);
    const contents = targetFolder.contents || [];

    let itemsToShow = contents;
    if (!options.showHidden) {
        itemsToShow = contents.filter(item => !item.isHidden);
    }

    if (itemsToShow.length === 0) {
        console.log('Папка порожня або містить лише приховані файли.');
    } else {
        itemsToShow.forEach(item => {
             console.log(`- ${item.name} (${item.type}) ${item.isHidden ? '[Прихований]' : ''}`);
        });
    }
  });

// 2. Сумарний розмір папки (рекурсивно)
function calculateSize(folder) {
    let size = folder.sizeBytes || 0;
    if (folder.contents && Array.isArray(folder.contents)) {
        folder.contents.forEach(item => {
            if (item.type === 'folder') {
                size += calculateSize(item);
            } else {
                size += item.sizeBytes || 0;
            }
        });
    }
    return size;
}

program
  .command('size')
  .description('Показати сумарний розмір каталогу (байти)')
  .action(() => {
    const opts = program.opts();
    const data = readData(opts);

    const totalSize = calculateSize(data);
    console.log(`Загальний розмір "${data.name}": ${totalSize} байт`);
  });

// 3. Пошук файлу чи папки за назвою
function searchByName(node, targetName, currentPath = '') {
    let results = [];
    const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;

    if (node.name.toLowerCase().includes(targetName.toLowerCase())) {
        results.push({ name: node.name, type: node.type, path: nodePath });
    }

    if (node.contents && Array.isArray(node.contents)) {
        node.contents.forEach(child => {
            results = results.concat(searchByName(child, targetName, nodePath));
        });
    }
    return results;
}

program
  .command('search <nameQuery>')
  .description('Знайти файл чи папку за назвою в усьому дереві')
  .action((nameQuery) => {
    const opts = program.opts();
    const data = readData(opts);

    const foundItems = searchByName(data, nameQuery);

    if (foundItems.length === 0) {
        console.log(`Нічого не знайдено за запитом "${nameQuery}".`);
    } else {
        console.log(`\nЗнайдено (${foundItems.length}):`);
        foundItems.forEach(item => {
            console.log(`- [${item.type}] ${item.name} (Шлях: ${item.path})`);
        });
    }
  });

// Парсимо аргументи з командного рядка
program.parse(process.argv);