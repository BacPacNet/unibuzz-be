import { universityController } from "../../modules/university"
import {Router} from "express"

const router = Router()




router.post("/create",universityController.createUniversity)
router.get("/all",universityController.getAllUniversity)
router.put("/update/:id",universityController.updateUniversity)
router.delete("/delete/:id",universityController.deleteUniversity)



export default router;