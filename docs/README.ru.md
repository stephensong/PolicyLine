# PolicyLine
Node.JS attribute based access control library

> This is a pre-alpha version(Concept approval). We will write full english documentation after implementation of demo projects.

## Что это

Библиотека реализующая ABAC(Attribute Based Access Control) для серверов на Node.JS. 

[![Attribute Based Access Control](./imgs/video.png)](https://www.youtube.com/watch?v=cgTa7YnGfHA "Attribute Based Access Control")

Более подробно можно почитать:

* [Подходы к контролю доступа: RBAC vs. ABAC](https://habrahabr.ru/company/custis/blog/248649/)
* [Знакомство с XACML — стандартом для Attribute-Based Access Control](https://habrahabr.ru/company/custis/blog/258861/)
* [Attribute-based access control(Wiki)](https://en.wikipedia.org/wiki/Attribute-based_access_control)
* [Guide to Attribute Based Access Control (ABAC)](http://nvlpubs.nist.gov/nistpubs/specialpublications/NIST.sp.800-162.pdf)

## Зачем

Необходим инструмент для изменения бизнес правил касаемо доступа, без переписывания серверного кода.

### Отличия от других библиотек:

1. Правила основаны на атрибутах, а не на ролях, что избавляет вас от необходимости введения механизма разрешений(пермишенов).
2. Позволяет динамически менять правила доступа на основе атрибутов без изменения кода приложения(без переписывания), так как все бизнес правила задаются в формате JSON.
3. В отличии от других библиотек, в бизнес правила включены не только правила доступа, но и возможность динамической фильтрации.

Что, фактически **позволяет вам настраивать бизнес логику приложения без изменения кода самого приложения**.

> Например, бизнес правило: **"*Старший менеджер из отдела закупок может подтверждать заказы на покупку, только если он не создатель заказа, заказ находиться в его филиале, стоимость заказа больше 100000, и не превышает лимит заказов на день*"**.
> 
> В этом случае правила приобретают вид:
> 
> ```JSON
> {
>  "target": [
>    "action.name='approve'",
>    "user.position='senior_manager'",
>    "user.department='purchasing_department'",
>    "user.approveLimit>user.approveTotal+action.transactionSum",
>    "action.transactionSum<100000"
>  ],
>  "condition": [
>    "resource.creator!=user.name",
>    "resource.branch=user.branch",
>    "resource.type='purchase_order'"
>  ],
>  "effect": "permit",
>  "algorithm": "all"
> }
> ```
> Эти правила вы можете загрузить, откомпилировать в функцию и использовать в мидлваре для ограничения доступа. Блока `condition`, представляет собой массив условий который динамически компилируеться(создается объект) в JSONB структуру из входных данных, который может быть использованн для дальнейшей фильтрации в [Mongoose](http://mongoosejs.com/docs/queries.html), [Sequelize](http://docs.sequelizejs.com/manual/tutorial/querying.html#jsonb) или для написания кастомной логики.

## API
Библиотека оперирует с четырьмя сущностями:

* `user` - объект пользователя, предоставляет информацию по каждому уникальному пользователю. Как правило в `express` внедряется в запрос как поле. 
* `action` - информация непосредственно о совершаемом действии. Может быть внедрена при конструировании мидлваре как мета информация.
* `env` - информация об окружении, содержащая как правило время и другую необходимую информацию.
* `resource` - объект с которым необходимо произвести действия. Так как с ресурсом необходимо как правило работать с отдельно, то желательно все взаимодействие вынести в блок `condition`, что позволит получать динамически создаваемые объекты(JSONB) с условиями, которые могут быть использованны для дальнейшей работы с ресурсами в [Mongoose](http://mongoosejs.com/docs/queries.html), [Sequelize](http://docs.sequelizejs.com/manual/tutorial/querying.html#jsonb) или для написания кастомной логики.


### Policy
Объект с помощью которого проверяются доступ, и вычисляются условия.

#### new Policy(`rules`)

Создает новую политику из правил. Во время создания политики, происходит компиляция правил в чистые функции.

```js
let policy = new Policy(rules);
```

Правила могут быть записаны в двух форматах:

##### В формате "Single Policy":

```js
let rules = {
    target: [
        "user.location='NY'"
    ],
    effect: "permit",
    algorithm: "all",
    condition:[
    	 "resource.location=user.location"
    ]
};

let policy = new Policy(rules);
```

Где поля:

* `target` - набор логических условий для вычисления политики, каждое условие возвращает `true`, `false` или ошибку в случае возникновения исключения. Может содержать любое логическое условие (`=`, `!=`, `<`, `>`, `>=`, `<=`). Выражения `==` и `=` однозначны. С обоих сторон выражения могут присутствовать простейшие логические или алгебраические выражения, а также вызовы синхронных функций, внедренных с помощью `DI`(Dependency Injection) функционала.

> Примеры валидных условий: 
> 
>  - `user.value>=3000`
>  - `user.value<=(3000-2000)*env.value`
>  - `$timeBetween($moment(env.time, 'HH:mm a').format('HH:mm a'),'9:00','18:00')=true`
> 
> Так как последнее условие является достаточно трудным для понимания, постарайтесь избегать таких ситуаций. Проще написать новую функцию, например `$time(env.time).between('9:00','18:00')=true` (данный пример просто демонстрация возможностей, и не содержиться в helper функциях(пресетах))

* `algorithm` - алгоритм по которому вычисляется политика по правилам, может принимать значение ***all*** или ***any***, в случае ***all*** все правило должны вернуть `true`, в случае ***any*** - любое. По умолчанию - ***all***.
* `effect` - эффект, который накладывают на результаты вычисления политики. Может принимать значения ***permit*** или ***deny***. По умолчанию - ***deny***. Если после вычисления правил и применения алгоритма, получено `true`, то накладывается эффект, и политика возвращает `true` если разрешено или `false` если запрещено, или в ходе вычисления политики произошла ошибка или использовано неизвестное значение.

> Обратите внимание, на то, что если в ходе вычисления политики произойдет **ошибка**, то **политика всегда вернет `false`, то есть запретит доступ к ресурсу**!
>

* `condition` - набор условий для доступа к ресурсу. При вызове метода `condition`, возвращает динамически скомпилированный объект условий. Формат записи отличается от формата записи `target`. Левой части выражения допустимы только символы из набора `[\w\.\'\"\$]+`, то есть имена объектов, их атрибуты и кавычки. Рекомендуется формировать условия следующим образом: `resource.attribute[.attribute]|condition|expression`, более подробно в описании метода `condition `

##### В формате "Policy Group":

```js
// all algorithms set in 'all' by default
// 'condition' is empty
let policyGroup = { 
    expression: '(user AND location)OR(admin OR super_admin)',
    policies: {
        user: {
            target: [
                "user.role='user'"
            ],
            effect: "permit"
        },
        location: {
            target: [
                "user.location=env.location"
            ],
            effect: "permit"
        },
        admin: {
            target: [
                "user.role='admin'"
            ],
            effect: "permit"
        },
        super_admin: {
            target: [
                "user.role='admin'"
            ],
            effect: "permit"
        }
    }
};

let policy = new Policy(rules);
```

Где поля:

* `expression` - логическое выражение с помощью которого составляют политика, где имена политик это название атрибутов в объекте `policies`.
* `policies` - Перечень политик в группе.

> Обратите внимание что `condition` в случае группы политик должны быть записаны отдельно, на одном уровне вместе с `expression` и `policies`, а не в каждой политике отдельно. Это сделано для того что группа политик все равно будет применяться к одному ресурсу, соответственно условия должны быть одинаковы.


#### check(`user`, `action`, `env`, `resource`)

Метод для вычисления политики, возвращает `true` `false` на основании вычисления правил с переданными параметрами, и применения к результату вычисления `algorithm` и `effect`.

```js
let rules = {
    target: [
        "user.value>=3000"
    ],
    effect: "permit",
    algorithm: "all"
};
let policy = new Policy(rules);

let user = {value: 4000};
policy.check(user) // <= true
```

#### and(`policy`)

Комбинирует текущую политику с переданной, с помощью булевой операции `AND` и возвращает как результат новую.

```js
let totalPolicy = policyA.and(policyB).and(policyC);
```

#### or(`policy`)
Комбинирует текущую политику с переданной, с помощью булевой операции `OR` и возвращает как результат новую.

```js
let totalPolicy = adminPolicy.or(userPolicy.and(locationPolicy));
```

#### condition(`user`, `action`, `env`, `resource`)

Метод позволяет, компилировать условия с учетов параметров `user`, `action`, `env`, `resource` текущих (переданных непосредственно в метод) и предыдущих, которые были использованы в методе `check` то есть в момент получения доступа к текущему ресурсу.
Метод возвращает динамически созданный объект с вычисленными значениями атрибутов на основе параметров перечисленных ранее.

То есть следующие условия:

```js
let rules = {
	...
    condition: [
        "resource.name='post'",
        "resource.location=user.location",
        "resource.limit>=(user.total + user.operation)",
    ]
};
```
при том что при проверке(`check` *and*|*or* `condition `) были использованы следующие параметры:

```js
let user = {location: 'NY', operation: 10, total: 120};
```
Вернут следующий объект с вычисляемыми полями, который можно использовать в запросе, или для написания дополнительной логики.

```js
let condition = {
    name: 'post',
    location: 'NY',
    limit: ['>=', 130]
};
```
То есть метод возвращает объект содержащий поля `user`, `action`, `env`, `resource` и `condition`. Причем `resource` при возврате будет с интегрирован с `condition`, для того что бы получить валидные условия для запроса в БД.

> Обратите внимание на условие `resource.limit>=(user.total + user.operation)` оно вернуло нам массив первым элементом которого идет условие, вторым вычисленное значение. Такие случаи вы должны описывать и обрабатывать самостоятельно. Некоторые базы данных позволяют вам использовать алиасы операций, например как [Sequelize](http://docs.sequelizejs.com/manual/tutorial/querying.html#jsonb), или формат JSONB  как [Mongoose](http://mongoosejs.com/docs/queries.html). Пример таких условий и сгенерированный объект будет приведен ниже:

Пример условий с условиями запроса:

```js
let policyGroup = { // all algorithms set in 'all' by default
    expression: '(user AND location)OR(admin OR super_admin)',
    policies: {
        ...
    },
    condition: [
        "resource.occupation=/host/",
        "resource.age.$gt=17",
        "resource.age.$lt=66",
        "'name.last'='Ghost'",
        "resource.likes.$in=['vaporizing', 'talking']",
    ]
};
```

```js
// mongoose JSONB object from 'http://mongoosejs.com/docs/queries.html'
let result = {
    occupation: /host/,
    'name.last': 'Ghost',
    age: {$gt: 17, $lt: 66},
    likes: {$in: ['vaporizing', 'talking']}
};
```

> **Обратите внимание что необходимость безопасности никто не отменял, поэтому необходимо правильно валидировать входные данные от клиента с учетом алиасов команд баз данных.**  


### DI

В выражениях(`target` и `condition`) можно использовать свои функции, которые внедряют с помощью механизма "Dependency Injection".

#### register(fnName, fn), register(fn)

Регистрирует функцию по имени или не анонимную, которую в дальнейшем можно использовать в выражениях.

```js
DI.register('$test', function (value) {
    return 'test_' + value;
});

let rules = {
    target: [
        "user.name=$test('Joe')"
    ]
};
```

#### unregister(fnName, fn), unregister(fn)

Удаляет зарегистрированную не анонимную функцию или по ее имени.

```js
 DI.unregister('$test');
```

#### clear()

Удаляет все зарегистрированные функция включая пресеты для обработки строк и времени.

```js
 DI.clear();
```

#### loadPresets()

Загружает все включенные в библиотеку вспомогательные функции. В данный момент, доступна работа со строками и временем, в будущем планируется реализация работы с *geohash* и расширение существующих.

```js
 DI.loadPresets();
```

### Settings

Объект с настройками, в данный момент, позволяет отменить вывод в консоль ошибки при выполнении условий политик.
> Как уже было упомянуто выше, при возникновении ошибки или исключения, во время вычисления политики, политика всегда вернет вам запрет доступа. Но при отладке, как правило важно видеть исключения произошедшие при расчете правил.

```js
let ABAC = require('policyline');

// disable errors notifications in console
ABAC.settings.log = false;
```


## Безопасность

Несмотря на то что в библиотеке используется генерация javascript кода, она достаточно безопасна, при соблюдении следующих условий:

1. Доступ к бизнес правилам не имеют сторонние люди, чтобы исключить механизм инъекции.
2. Входящие данные с клиента должны быть проваледированны с учетом всех алиасов команд баз данных.