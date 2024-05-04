import { universityController } from "../../modules/university"
import {Router} from "express"

const router = Router()


router
.route("/")
.post(universityController.createUniversity)
.get(universityController.getAllUniversity)

router
.route("/:id")
.delete(universityController.deleteUniversity)
.put(universityController.updateUniversity)


router.get("/searched",universityController.searchUniversityByQuery)



export default router;


/**
 * @swagger
 * tags:
 *   name: Universities
 *   description: API endpoints for managing universities
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     University:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The unique identifier of the university
 *         name:
 *           type: string
 *           description: The name of the university
 *         score:
 *           type: string
 *           description: The score of the university
 *         city:
 *           type: string
 *           description: The city where the university is located
 *         country:
 *           type: string
 *           description: The country where the university is located
 *         collegePage:
 *           type: string
 *           description: The URL of the university's college page
 *         tuitionFee:
 *           type: string
 *           description: The tuition fee of the university
 *         undergraduatePrograms:
 *           type: integer
 *           description: The number of undergraduate programs offered
 *         programs:
 *           type: array
 *           description: List of programs offered by the university
 *           items:
 *             type: object
 *             properties:
 *               program:
 *                 type: string
 *                 description: The name of the program
 *               courses:
 *                 type: array
 *                 description: List of courses under the program
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       description: The name of the course
 *                     degrees:
 *                       type: array
 *                       description: List of degrees offered for the course
 *                       items:
 *                         type: object
 *                         properties:
 *                           degreeTitle:
 *                             type: string
 *                             description: The title of the degree
 *                           durationYears:
 *                             type: number
 *                             description: The duration of the degree in years
 *                           description:
 *                             type: string
 *                             description: Description of the degree
 *                           requirements:
 *                             type: string
 *                             description: Admission requirements for the degree
 */

/**
 * @swagger
 * /university:
 *   post:
 *     summary: Create a new university
 *     tags: [Universities]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/University'
 *           example:
 *             id: "1"
 *             name: "Example University"
 *             score: "A+"
 *             city: "Example City"
 *             country: "Example Country"
 *             collegePage: "https://exampleuniversity.com"
 *             tuitionFee: "10000"
 *             undergraduatePrograms: 20
 *             programs:
 *               - program: "Computer Science"
 *                 courses:
 *                   - name: "Introduction to Programming"
 *                     degrees:
 *                       - degreeTitle: "Bachelor of Science in Computer Science"
 *                         durationYears: 4
 *                         description: "Learn the basics of programming"
 *                         requirements: "High school diploma"
 *     responses:
 *       '201':
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/University'
 */



/**
 * @swagger
 * /university:
 *   get:
 *     summary: Get a list of universities.
 *     tags: [Universities]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: The page number for pagination (default is 1).
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: The maximum number of universities per page (default is 10).
 *     responses:
 *       '200':
 *         description: A paginated list of universities.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/University'
 */


/**
 * @swagger
 * /university/{id}:
 *   put:
 *     summary: Update a university by ID
 *     tags: [Universities]
 *     parameters:
 *       - in: path
 *         name: id
 *         description: ID of the university to update
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/University'
 *           example:
 *             name: "Updated University Name"
 *             score: "A++"
 *     responses:
 *       '200':
 *         description: Updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/University'
 *       '404':
 *         description: University not found
 */


/**
* @swagger
 * /university/{id}:
 *   delete:
 *     summary: Delete a university by ID
 *     tags: [Universities]
 *     parameters:
 *       - in: path
 *         name: id
 *         description: ID of the university to delete
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: deleted
 *       '404':
 *         description: Failed to delete
 */



/**
* @swagger
 * /university/searched:
 *   get:
 *     summary: Search universities by name or country.
 *     tags: [Universities]
 *     parameters:
 *       - in: query
 *         name: searchTerm
 *         schema:
 *           type: string
 *         description: The search term for filtering universities by name or country.
 *     responses:
 *       '200':
 *         description: A list of universities matching the search term.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/University'
 */