import { universityController } from "../../modules/university"
import {Router} from "express"

const router = Router()
// console.log("log");


router.get("/",(req,res)=>{
   res.send("aaa")
    console.log(req);
    
    res.status(200).json("aaaa")
})

router.post("/create",universityController.createUniversity)
router.get("/all",universityController.getAllUniversity)
router.put("/update/:id",universityController.updateUniversity)
router.delete("/delete/:id",universityController.deleteUniversity)



export default router;