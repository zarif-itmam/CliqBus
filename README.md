# [Getting Started](#getting-started)
# [Database Setup](#database-setup)
# [Directions](#directions)
# [Features](#features)
 CliqBus is our level-2, term-1 database project. It is a comprehensive bus ticketing system designed to streamline the process of booking, managing, and monitoring bus services. The system caters to three main user roles: users, admins, and bus companies. 

# <a name="getting-started">Getting Started</a>

To run the project clone the repository and just run the command ``npm i`` from the command line. This will install the required dependencies as specified in the ``package-lock.json`` file.

Now run the command ``npm start`` to start the server. 

# <a name="databse-setup">Database Setup</a>

Create the required tables using the statements from the ``creates.sql`` file under the ``Queries`` folder.
For feeding data into the tables run the statements from the ``inserts_updates.sql`` file under the same folder mentioned above.
The database functions are available in the ``functions.sql`` file.
The stored procedures are in ``procedures.sql``.
The triggers are available in ``triggers.sql``.

# <a name="directions">Directions</a>

After starting the server head over to [login](http://localhost:5000/login). From here you can register as a new user using the [register](http://localhost:5000/register) link. After typing in the correct credentials, you will be directed to the home page. But you can access all features without login except for ticket booking. For this you have to head over to [home](http://localhost:5000/home). For accessing the bus company and admin side use the same [login](http://localhost:5000/login) route with specific email addresses.

# <a name="features">Features</a>

- ## User side
    -  login and authentication
    -  user profile
    -  managing upcoming reservations
    -  reviewing past trips
    -  reviewing the overall user experience
    -  searching for different buses based on routes and schedules
- ## Admin side
    -  information about different database entities
    -  routes handling
    -  function and procedure calling logs
    -  analytics of bus companies
- ## Bus company side
    -  bus company profile
    -  manage the buses owned by the enterprise
    -  analytics regarding the company

