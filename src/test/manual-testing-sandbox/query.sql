CREATE TABLE employee (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT NOT NULL,
    position VARCHAR(100)
);

INSERT INTO employee (name, age, position) VALUES ('John Doe', 30, 'Developer');
SELECT * FROM employee WHERE age > 25;
