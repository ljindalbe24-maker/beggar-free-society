require("dotenv").config();
var express = require("express");
var fileuploader = require("express-fileupload");
var cloudinary = require("cloudinary").v2;
var mysql = require("mysql2");
var nodemailer = require("nodemailer");

var app = express();

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI("AIzaSyBy_3nnA_vHzpWJGBkUyiW4_wv68UEFdFo");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ================= SERVER =================
app.listen(2003, function () {
    console.log("Server running on http://localhost:2003");
});

// ================= MIDDLEWARES =================
app.use(fileuploader());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));



// ================= SERVE HTML =================
app.get("/", function (req, resp) {
    resp.sendFile(__dirname + "/public/maindash.html");
});

// ================= CLOUDINARY =================


cloudinary.config({
    cloud_name: "dmyau6ma2",
    api_key: "321513861558265",
    api_secret: "0yHe7f4ao5VmtCcC6j53SbweHao"
});

// ================= MYSQL =================
let url = "mysql://avnadmin:AVNS_qiwkf9eatb5AMpoUFak@mysql-1d01ba3e-thapar-db7c.a.aivencloud.com:10494/defaultdb";
let MysqlCon = mysql.createConnection(url);

MysqlCon.connect(function (err) {
    if (!err)
        console.log("MySQL Connected");
    else
        console.log(err.message);
});
app.post("/hire-worker", (req, res) => {

    let proof_number = req.body.proof_number;
    let email = req.body.email;

    // Step 1: save proof_number in profileCitizen
    let query1 = `
        UPDATE profileCitizen 
        SET hired_proof_number = ?
        WHERE email = ?
    `;

    MysqlCon.query(query1, [proof_number, email], (err, result) => {

        if (err) {
            console.log(err);
            return res.send("Error in profileCitizen");
        }

        // Step 2: update baggers status
        let query2 = `
            UPDATE baggers 
            SET status = 0
            WHERE proof_number = ? AND status = 1
        `;

        MysqlCon.query(query2, [proof_number], (err2, result2) => {

            if (err2) {
                console.log(err2);
                res.send("Error in baggers");
            } 
            else if (result2.affectedRows === 0) {
                res.send("Already hired");
            } 
            else {
                res.send("Hired successfully");
            }
        });
    });
});

// ================= NODEMAILER =================
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function sendWelcomeEmail(to) {
    try {
        await transporter.sendMail({
            from: `"Volunteer Portal" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: "Welcome to Volunteer Portal 🎉",
            html: `<h2>Welcome!</h2><p>Your signup was successful.</p>`
        });
        console.log("Welcome email sent");
    } catch (err) {
        console.log("Email Error:", err.message);
    }
}

// ================= SIGNUP =================
app.post("/submitsignup", function (req, resp) {

    let emailid = req.body.signupname;
    let pwd = req.body.signuppass;
    let utype = req.body.utype2;

    MysqlCon.query(
        "INSERT INTO users2026 (emailid, pwd, utype) VALUES (?, ?, ?)",
        [emailid, pwd, utype],
        function (err) {
            if (!err) {
                sendWelcomeEmail(emailid);
                resp.send("Signup Successful & Email Sent");
            } else
                resp.send(err.message);
        }
    );
});
app.get("/find-beggars", (req, res) => {

    let work_type = req.query.work_type || "";
    let city = req.query.city || "";

    console.log("Work:", work_type, "City:", city); // debug

    let query = `
        SELECT * FROM baggers
        WHERE status = 1
        AND (? = '' OR LOWER(work_type) = LOWER(?))
        AND (? = '' OR LOWER(city) = LOWER(?))
    `;

    MysqlCon.query(query, [work_type, work_type, city, city], (err, result) => {

        if (err) {
            console.log("DB ERROR:", err);
            res.send([]);
        } else {
            console.log("RESULT:", result); // debug
            res.send(result);
        }
    });
});
// ================= LOGIN =================
app.post("/submitlogin", function (req, resp) {

    let emailid = req.body.loginname;
    let pwd = req.body.loginpass;

    // Admin check
    if (emailid === "admin@gmail.com" && pwd === "admin123") {
        return resp.send("admin");
    }

    MysqlCon.query(
        "SELECT utype FROM users2026 WHERE emailid=? AND pwd=? AND status=1",
        [emailid, pwd],
        function (err, result) {

            if (err)
                return resp.send(err.message);

            if (result.length > 0) {
                let type = result[0].utype.toLowerCase();

                if (type === "citizen")
                    resp.send("citizen");
                else
                    resp.send("user"); // volunteer / ngo
            }
            else {
                resp.send("Invalid credentials or Account Blocked");
            }
        }
    );
});

// ================= SAVE PROFILE =================
app.post("/savenow", async function (req, resp) {

    try {

        let { emailid, name, contact, address, city, gender, occupation, combomode, gstin } = req.body;

        let picurl = "No_Pic.jpg";
        let aadharpicurl = "No_Aadhar.jpg";

        if (combomode !== "NGO") {
            gstin = null;
        }

        // Upload Profile Photo
        if (req.files && req.files.profilephoto) {
            let file = req.files.profilephoto;
            let fullPath = __dirname + "/uploads/" + Date.now() + "_" + file.name;
            await file.mv(fullPath);
            let result = await cloudinary.uploader.upload(fullPath);
            picurl = result.secure_url;
        }

        // Upload Aadhar Photo
        if (req.files && req.files.aadharpic) {
            let file = req.files.aadharpic;
            let fullPath = __dirname + "/uploads/" + Date.now() + "_" + file.name;
            await file.mv(fullPath);
            let result = await cloudinary.uploader.upload(fullPath);
            aadharpicurl = result.secure_url;
        }

        MysqlCon.query(
            "INSERT INTO volprofile (emailid, name, contact, address, city, gender, occupation, picurl, aadharpicurl, combomode, gstin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [emailid, name, contact, address, city, gender, occupation, picurl, aadharpicurl, combomode, gstin],
            function (err) {
                if (err)
                    resp.send(err.message);
                else
                    resp.send("Profile Saved Successfully");
            }
        );

    } catch (err) {
        resp.send(err.message);
    }
});

// ================= UPDATE PROFILE =================
app.post("/doupdate", async function (req, resp) {

    try {

        let { emailid, name, contact, address, city, gender, occupation, combomode, gstin } = req.body;

        let picurl;
        let aadharpicurl;

        if (combomode !== "NGO") {
            gstin = null;
        }

        // Update Profile Pic
        if (req.files && req.files.profilephoto) {
            let file = req.files.profilephoto;
            let fullPath = __dirname + "/uploads/" + Date.now() + "_" + file.name;
            await file.mv(fullPath);
            let result = await cloudinary.uploader.upload(fullPath);
            picurl = result.secure_url;
        } else {
            picurl = req.body.oldpicurl;
        }

        // Update Aadhar Pic
        if (req.files && req.files.aadharpic) {
            let file = req.files.aadharpic;
            let fullPath = __dirname + "/uploads/" + Date.now() + "_" + file.name;
            await file.mv(fullPath);
            let result = await cloudinary.uploader.upload(fullPath);
            aadharpicurl = result.secure_url;
        } else {
            aadharpicurl = req.body.oldaadharpicurl;
        }

        MysqlCon.query(
            "UPDATE volprofile SET name=?, contact=?, address=?, city=?, gender=?, occupation=?, picurl=?, aadharpicurl=?, combomode=?, gstin=? WHERE emailid=?",
            [name, contact, address, city, gender, occupation, picurl, aadharpicurl, combomode, gstin, emailid],
            function (err, result) {
                if (err)
                    resp.send(err.message);
                else if (result.affectedRows > 0)
                    resp.send("Profile Updated Successfully");
                else
                    resp.send("No record found");
            }
        );

    } catch (err) {
        resp.send(err.message);
    }
});


app.get("/findone", function (req, resp) {

    let emailid = req.query.emailid;

    MysqlCon.query(
        "SELECT * FROM volprofile WHERE emailid=?",
        [emailid],
        function (err, result) {
            if (err)
                resp.send(err.message);
            else
                resp.send(result);
        }
    );
});



app.get("/angular-fetchall-beggars", function (req, resp) {

    MysqlCon.query(
        "SELECT * FROM baggers",
        function (err, result) {

            if (err) {
                console.log(err);
                resp.send(err.message);
            }
            else {
                resp.json(result);
            }
        }
    );

});
app.get("/fetch-beggars-by-email", function (req, resp) {

    let email = req.query.email;

    MysqlCon.query(
        "SELECT * FROM baggers WHERE volunteer_id=?",
        [email],
        function (err, result) {

            if (err) return resp.send(err.message);

            resp.json(result);
        }
    );
});
app.get("/angular-beggar-block", function (req, resp) {

    let id = req.query.id;

    MysqlCon.query(
        "UPDATE baggers SET status=0 WHERE volunteer_id=?",
        [id],
        function (err, result) {

            if (err) return resp.send(err.message);

            resp.send("Blocked Successfully");
        }
    );
});
app.get("/angular-beggar-resume", function (req, resp) {

    let id = req.query.id;

    MysqlCon.query(
        "UPDATE baggers SET status=1 WHERE volunteer_id=?",
        [id],
        function (err, result) {

            if (err) return resp.send(err.message);

            resp.send("Resumed Successfully");
        }
    );
});
app.get("/delete-beggar", function (req, resp) {

    let id = req.query.id;

    MysqlCon.query(
        "DELETE FROM baggers WHERE volunteer_id=?",
        [id],
        function (err, result) {

            if (err) return resp.send(err.message);

            resp.send("Deleted Successfully");
        }
    );
});
app.get("/resetpass", function (req, resp) {

    var email = req.query.email;
    var oldPass = req.query.oldPass;
    var newPass = req.query.newPass;



    MysqlCon.query(
        "UPDATE users2026 SET pwd=? WHERE emailid=? AND pwd=?",
        [newPass, email, oldPass],
        function (err, result) {

            if (err) {
                resp.send(err.message);
            }
            else if (result.affectedRows == 0) {
                resp.send("Invalid Email or Old Password");
            }
            else {
                resp.send("Password Changed Successfully");
            }
        }
    );
});
app.get("/angular-fetchall", function (req, resp) {

    MysqlCon.query(
        "SELECT * FROM users2026",
        function (err, result) {

            if (err) {
                console.log(err);
                resp.send(err.message);
            }
            else {
                resp.json(result);
            }
        }
    );
});
app.get("/angular-beggar-block", function (req, resp) {

    var id = req.query.id;

    MysqlCon.query(
        "UPDATE baggers SET status = 0 WHERE volunteer_id = ?",
        [id],
        function (err, result) {
            if (err) {
                resp.send(err.message);
            } else {
                resp.send("Beggar Blocked");
            }
        }
    );

});
app.get("/angular-beggar-resume", function (req, resp) {

    var id = req.query.id;

    MysqlCon.query(
        "UPDATE baggers SET status = 1 WHERE volunteer_id = ?",
        [id],
        function (err, result) {
            if (err) {
                resp.send(err.message);
            } else {
                resp.send("Beggar Resumed");
            }
        }
    );

});
app.get("/angular-user-block", function (req, resp) {

    let emailid = req.query.emailid;

    MysqlCon.query(
        "UPDATE users2026 SET status=0 WHERE emailid=?",
        [emailid],
        function (err, result) {

            if (err)
                resp.send(err.message);
            else if (result.affectedRows > 0)
                resp.send("User Blocked Successfully");
            else
                resp.send("User Not Found");
        }
    );
});
app.get("/angular-user-resume", function (req, resp) {

    let emailid = req.query.emailid;

    MysqlCon.query(
        "UPDATE users2026 SET status=1 WHERE emailid=?",
        [emailid],
        function (err, result) {

            if (err)
                resp.send(err.message);
            else if (result.affectedRows > 0)
                resp.send("User Activated Successfully");
            else
                resp.send("User Not Found");
        }
    );
});


app.get("/angular-fetch-citizens", function (req, resp) {

    MysqlCon.query(
        "SELECT * FROM users2026 WHERE utype='Citizen'",
        function (err, result) {

            if (err)
                return resp.send(err.message);

            resp.json(result);
        }
    );
});
app.get("/angular-fetch-volunteers", function (req, resp) {

    MysqlCon.query(
        "SELECT * FROM users2026 WHERE utype='Volunteer'",
        function (err, result) {

            if (err)
                return resp.send(err.message);

            resp.json(result);
        }
    );
});
app.get("/angular-user-resume", function (req, resp) {

    let emailid = req.query.emailid;

    MysqlCon.query(
        "UPDATE users2026 SET status=1 WHERE emailid=?",
        [emailid],
        function (err, result) {

            if (err)
                return resp.send(err.message);

            if (result.affectedRows > 0)
                resp.send("User Activated Successfully");
            else
                resp.send("User Not Found");
        }
    );
});
// ================= FETCH CITIZEN =================

app.get("/findCitizen", function (req, resp) {

    let emailid = req.query.emailid;

    MysqlCon.query(
        "SELECT * FROM profileCitizen WHERE emailid=?",
        [emailid],
        function (err, result) {

            if (err)
                resp.send(err.message);
            else
                resp.send(result);
        }
    );

});
// SAVE CITIZEN PROFILE
app.post("/saveCitizen", async function (req, resp) {

    let {
        emailid,
        mobile,
        name,
        aadharno,
        fathers,
        dob,
        gender,
        address,
        city
    } = req.body;

    let frontpic = "";
    let backpic = "";

    // Aadhaar Front Upload
    if (req.files && req.files.frontpic) {

        let file = req.files.frontpic;

        let path = __dirname + "/uploads/" + file.name;

        await file.mv(path);

        let result = await cloudinary.uploader.upload(path);

        frontpic = result.secure_url;
    }

    // Aadhaar Back Upload
    if (req.files && req.files.backpic) {

        let file = req.files.backpic;

        let path = __dirname + "/uploads/" + file.name;

        await file.mv(path);

        let result = await cloudinary.uploader.upload(path);

        backpic = result.secure_url;
    }

    MysqlCon.query(
        "INSERT INTO profileCitizen VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        [emailid, mobile, name, aadharno, fathers, dob, gender, address, city, frontpic, backpic],
        function (err) {

            if (err)
                resp.send(err.message);
            else
                resp.send("Citizen Profile Saved");

        }
    );

});

app.get("/find-beggars", function (req, resp) {

    let work = req.query.work_type;
    let city = req.query.city;

    let query = "SELECT * FROM baggers WHERE 1=1";
    let params = [];

    if (work) {
        query += " AND work_type=?";
        params.push(work);
    }

    if (city) {
        query += " AND city=?";
        params.push(city);
    }

    MysqlCon.query(query, params, function (err, result) {

        if (err) {
            console.log(err);
            resp.send(err.message);
        }
        else {
            resp.json(result);
        }
    });

});
async function RajeshBansalKaChirag(imgurl) {

    const myprompt = `
Extract Aadhaar details from image.

Rules:
- Aadhaar number must be EXACTLY 12 digits
- Do NOT guess
- If not visible, return empty string
- dob in format dd-mm-yyyy
Return ONLY JSON:
{
  "aadhaar_number": "",
  "name": "",
  "gender": "",
  "dob": ""
}
`;

    const imageResp = await fetch(imgurl)
        .then(res => res.arrayBuffer());

    const result = await model.generateContent([
        {
            inlineData: {
                data: Buffer.from(imageResp).toString("base64"),
                mimeType: "image/jpeg",
            },
        },
        myprompt,
    ]);

    const cleaned = result.response.text().replace(/```json|```/g, '').trim();

    try {
        return JSON.parse(cleaned);
    } catch {
        console.log("AI RAW:", cleaned);
        return {};
    }
}

app.post("/savebagger", async function (req, resp) {
    try {

        let {
            volunteer_email,
            address,
            city,
            work_type,
            contact_number,
            id_proof
        } = req.body;

        let proof_pic_url = "No_Proof.jpg";
        let person_pic_url = "No_Person.jpg";

        let name = "";
        let dob = "";
        let gender = "";
        let proof_number = "";

        // ✅ Upload proof + AI
        if (req.files && req.files.proof_pic) {

            let file = req.files.proof_pic;
            let path = __dirname + "/uploads/" + Date.now() + "_" + file.name;

            await file.mv(path);

            let result = await cloudinary.uploader.upload(path);
            proof_pic_url = result.secure_url;

            // 🔥 AI CALL
            let aiData = await RajeshBansalKaChirag(proof_pic_url);

            console.log("AI DATA:", aiData);

            name = aiData.name || "";
            gender = aiData.gender || "";
            dob = aiData.dob || "";

            // clean aadhaar
            let raw = aiData.aadhaar_number || "";
            proof_number = raw.replace(/\D/g, "");
            if (proof_number.length !== 12) proof_number = "";



        }

        // ✅ Upload person pic
        if (req.files && req.files.person_pic) {
            let file = req.files.person_pic;
            let path = __dirname + "/uploads/" + Date.now() + "_" + file.name;

            await file.mv(path);
            let result = await cloudinary.uploader.upload(path);
            person_pic_url = result.secure_url;
        }

        // ✅ SAVE
        MysqlCon.query(
            `INSERT INTO baggers 
            (volunteer_id, bagger_name, dob, gender, address, city, 
             work_type, contact_number, id_proof, proof_number, 
             proof_pic_url, person_pic_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                volunteer_email,
                name,
                dob,
                gender,
                address,
                city,
                work_type,
                contact_number,
                id_proof,
                proof_number,
                proof_pic_url,
                person_pic_url
            ],
            function (err) {
                if (err)
                    return resp.send(err.message);

                resp.send("Saved with AI");
            }
        );

    } catch (err) {
        resp.send(err.message);
    }
});